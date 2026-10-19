/** @type {import('./_venera_.js')} */
class DM5 extends ComicSource {
  name = "动漫屋";
  key = "dm5";
  version = "1.0.1";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/dm5.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://m.dm5.com", text: "m.dm5.com (主站)" },
        { value: "https://www.dm5.com", text: "www.dm5.com (备用)" }
      ],
      default: "https://m.dm5.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://m.dm5.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36",
      "Referer": this.baseUrl + "/"
    };
  }

  parseComic(item) {
    const link = item.querySelector("a");
    if (!link) return null;
    const href = link.attributes.href;
    // 处理两种链接格式: /manhua-xxx/ 和 /m123456/
    let id = href;
    if (href.includes("/manhua-")) {
      id = href.split("/manhua-")[1].split("/")[0];
    } else if (href.includes("/m")) {
      id = href.split("/m")[1].split("/")[0];
    } else {
      id = href.split("/").pop().replace(".html", "");
    }
    const title = item.querySelector(".manga-list-2-title, .manga-book-list-main-title, .title, .new-search-list-content .left")?.text?.trim() || link.text.trim();
    const cover = item.querySelector("img")?.attributes?.["data-src"] || item.querySelector("img")?.attributes?.src || item.querySelector("img")?.attributes?.["src"];
    const author = item.querySelector(".author, .book-author")?.text?.trim() || "";
    const update = item.querySelector(".manga-list-1-tip, .new-search-list-right")?.text?.trim() || "";
    if (!id || !title) return null;
    return new Comic({
      id, title,
      subTitle: author,
      cover: this.fixUrl(cover),
      tags: [],
      description: update
    });
  }

  fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.baseUrl.replace(/\/$/, "") + "/" + u.replace(/^\//, "");
  }

  explore = [{
    title: "动漫屋",
    type: "multiPartPage",
    load: async (page) => {
      let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `首页加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      const result = {};
      // 精品书单
      let hotItems = doc.querySelectorAll(".manga-book-list-main");
      if (hotItems.length > 0) {
        result["精品书单"] = hotItems.map(e => this.parseComic(e)).filter(Boolean);
      }
      // 强势安利
      let newItems = doc.querySelectorAll(".manga-list-1 li");
      if (newItems.length > 0) {
        result["强势安利"] = newItems.map(e => this.parseComic(e)).filter(Boolean);
      }
      // 排行榜
      let rankItems = doc.querySelectorAll(".rank-list li, .rank-list-cover");
      if (rankItems.length > 0) {
        result["排行榜"] = rankItems.map(e => this.parseComic(e)).filter(Boolean);
      }
      return result;
    }
  }];

  category = null;

  search = {
    load: async (keyword, options, page) => {
      let url = `${this.baseUrl}/search.ashx?key=${encodeURIComponent(keyword)}&page=${page}`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `搜索失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      let items = doc.querySelectorAll(".new-search-list-item");
      return {
        comics: items.map(e => this.parseComic(e)).filter(Boolean),
        maxPage: page + 1
      };
    }
  };

  comic = {
    loadInfo: async (id) => {
      // 尝试两种详情页 URL 格式
      let url = `${this.baseUrl}/manhua-${id}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        url = `${this.baseUrl}/${id}/`;
        res = await Network.get(url, this.headers);
      }
      if (res.status !== 200) throw `详情加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      
      let title = doc.querySelector(".detail-main-info-title")?.text?.trim() || id;
      let cover = doc.querySelector(".detail-main-cover img")?.attributes?.src || "";
      let author = doc.querySelector(".detail-main-info-author a")?.text?.trim() || "";
      let description = doc.querySelector(".detail-desc")?.text?.trim() || "";
      let update = doc.querySelector(".detail-bottom-btn.chapter-item")?.text?.trim() || "";
      
      // 获取标签
      let tags = [];
      let classLinks = doc.querySelectorAll(".detail-main-info-class a");
      for (let link of classLinks) {
        tags.push(link.text.trim());
      }
      
      // 章节列表
      let chapters = new Map();
      let chapterLinks = doc.querySelectorAll(".detail-list-1.detail-list-select .chapteritem");
      let i = 0;
      for (let link of chapterLinks) {
        let href = link.attributes.href;
        let cid = href.split("/").pop().replace(".html", "");
        let ctitle = link.text.trim();
        if (cid && ctitle) {
          chapters.set(i.toString(), ctitle);
          i++;
        }
      }

      return new ComicDetails({
        title, cover: this.fixUrl(cover),
        description, tags: { 作者: [author], 分类: tags, 更新: [update] },
        chapters, updateTime: update
      });
    },

    loadEp: async (comicId, epId) => {
      let url = `${this.baseUrl}/m${epId}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        url = `${this.baseUrl}/manhua-${comicId}/${epId}.html`;
        res = await Network.get(url, this.headers);
      }
      if (res.status !== 200) throw `章节加载失败: ${res.status}`;
      
      // DM5 使用 JS 动态生成图片 URL，需要执行 JS 解密
      // 从页面脚本中提取 newImgs 数组
      let html = res.body;
      
      // 尝试从 eval 代码中提取图片列表
      let images = [];
      
      // 方法1: 直接查找 newImgs 变量
      const newImgsMatch = html.match(/var newImgs\s*=\s*(\[[\s\S]*?\]);/);
      if (newImgsMatch) {
        try {
          images = JSON.parse(newImgsMatch[1]);
        } catch (e) {
          // 尝试 eval
          try {
            const evalCode = `var newImgs = []; ${newImgsMatch[0]}; newImgs;`;
            images = await compute(evalCode);
          } catch (e2) {}
        }
      }
      
      // 方法2: 查找 eval 解码
      if (images.length === 0) {
        const evalMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\)/);
        if (evalMatch) {
          try {
            // 这个需要完整的解密逻辑，暂时回退到 DOM 解析
          } catch (e) {}
        }
      }
      
      // 方法3: DOM 解析 (图片懒加载)
      if (images.length === 0) {
        let doc = new HtmlDocument(res.body);
        let imgNodes = doc.querySelectorAll("#cp_img img, .view-main-1 img, .read-content img");
        for (let img of imgNodes) {
          let src = img.attributes["data-src"] || img.attributes["src"] || "";
          if (src && src.includes("cdndm5.com")) {
            images.push(this.fixUrl(src));
          }
        }
      }
      
      return { images: images.map(img => this.fixUrl(img)) };
    }
  };
}

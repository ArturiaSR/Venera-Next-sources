/** @type {import('./_venera_.js')} */
class Kanman extends ComicSource {
  name = "看漫画";
    key = "kanman";
    version = "1.0.1";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/kanman.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://www.kanman.com", text: "kanman.com (主站)" },
        { value: "https://m.kanman.com", text: "m.kanman.com (移动端)" }
      ],
      default: "https://www.kanman.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://www.kanman.com";
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
      const id = href.split("/").pop().replace(".html", "");
      const title = item.querySelector(".book-title, .book-main-title, .title, h3")?.text?.trim() || link.text.trim();
      const cover = item.querySelector(".book-cover img, .book-main-cover img")?.attributes?.src || item.querySelector("img")?.attributes?.src;
      const author = item.querySelector(".book-author, .author, .book-author-name")?.text?.trim() || "";
      const update = item.querySelector(".update, .chapter, .latest")?.text?.trim() || "";
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
      title: "看漫画",
      type: "multiPartPage",
      load: async (page) => {
        let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
        const result = {};
        let items = doc.querySelectorAll(".book, .block-item, .book-list li");
        if (items.length > 0) {
          result["推荐漫画"] = items.map(e => this.parseComic(e)).filter(Boolean);
        }
        return result;
      }
    }];

  category = {
    title: "看漫画分类",
    parts: [{
      name: "分类",
      type: "fixed",
      categories: ["热血", "魔幻", "冒险", "格斗", "科幻", "机战", "悬疑", "推理", "校园", "恋爱", "搞笑", "生活", "其他"],
      categoryParams: ["rexue", "mohuan", "maoxian", "gedou", "kehuan", "jizhan", "xuanyi", "tuili", "xiaoyuan", "lianai", "gaoxiao", "shenghuo", "qita"],
      itemType: "category"
    }],
    enableRankingPage: false
  };

  categoryComics = {
      load: async (category, param, options, page) => {
        let url = `${this.baseUrl}/list/${param}/${page}.html`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `分类加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
        let items = doc.querySelectorAll(".book, .block-item, .book-list li");
        return {
          comics: items.map(e => this.parseComic(e)).filter(Boolean),
          maxPage: page + 1
        };
      }
    };

    search = {
      load: async (keyword, options, page) => {
        let url = `${this.baseUrl}/search/${encodeURIComponent(keyword)}/${page}.html`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `搜索失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
        let items = doc.querySelectorAll(".book, .block-item, .book-list li, .search-result li");
        return {
          comics: items.map(e => this.parseComic(e)).filter(Boolean),
          maxPage: page + 1
        };
      }
    };

  comic = {
      loadInfo: async (id) => {
        let url = `${this.baseUrl}/comic/${id}/`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `详情加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
      
        let title = doc.querySelector(".book-title, .book-main-title, h1, .detail-title")?.text?.trim() || id;
        let cover = doc.querySelector(".book-cover img, .book-main-cover img, .detail-cover img")?.attributes?.src || "";
        let author = doc.querySelector(".book-author, .book-author-name, .author")?.text?.trim() || "";
        let description = doc.querySelector(".book-intro, .book-desc, .intro, .description")?.text?.trim() || "";
        let update = doc.querySelector(".last-chapter, .update-chapter, .book-update")?.text?.trim() || "";
        let status = doc.querySelector(".book-status, .book-state, .status")?.text?.trim() || "";
      
        let chapters = new Map();
        let chapterLinks = doc.querySelectorAll(".chapter-list a, .book-chapters a, .catalog a, .detail-list a");
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
          description, tags: { 作者: [author], 状态: [status], 更新: [update] },
          chapters, updateTime: update
        });
      },

      loadEp: async (comicId, epId) => {
        let url = `${this.baseUrl}/comic/${comicId}/${epId}.html`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `章节加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
      
        let images = [];
        let imgNodes = doc.querySelectorAll(".chapter-images img, .chapter-content img, .read-content img, .book-read img");
        for (let img of imgNodes) {
          let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
          if (src) images.push(this.fixUrl(src));
        }
        return { images };
      }
    };
}

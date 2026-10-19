/** @type {import('./_venera_.js')} */
class Haoduoman extends ComicSource {
  name = "好多漫画";
  key = "haoduoman";
  version = "1.0.1";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/haoduoman.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://www.haoduoman.com", text: "www.haoduoman.com (PC主站)" },
        { value: "https://m.haoduoman.com", text: "m.haoduoman.com (移动端)" }
      ],
      default: "https://www.haoduoman.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://www.haoduoman.com";
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
    const id = href.split("/manhua/")[1]?.split("/")[0] || href.split("/").pop();
    const title = item.querySelector(".name, .title, h3")?.text?.trim() || link.text.trim();
    const cover = item.querySelector(".image.lazy")?.attributes?.["data-original"] || item.querySelector("img")?.attributes?.src;
    const update = item.querySelector(".chapter")?.text?.trim() || "";
    if (!id || !title) return null;
    return new Comic({
      id, title,
      subTitle: "",
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
    title: "好多漫画",
    type: "multiPartPage",
    load: async (page) => {
      let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `首页加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      const result = {};
      // 国内/日本/韩国/欧美 面板
      let panels = doc.querySelectorAll(".panel.is-white");
      for (let panel of panels) {
        let panelTitle = panel.querySelector(".panel-heading h2")?.text?.trim() || "推荐";
        let items = panel.querySelectorAll(".cell.comic-item");
        if (items.length > 0) {
          result[panelTitle] = items.map(e => this.parseComic(e)).filter(Boolean);
        }
      }
      return result;
    }
  }];

  category = {
    title: "好多漫画分类",
    parts: [{
      name: "地区",
      type: "fixed",
      categories: ["国内", "日本", "韩国", "欧美"],
      categoryParams: ["guonei", "riben", "hanguo", "oumei"],
      itemType: "category"
    }, {
      name: "题材",
      type: "fixed",
      categories: ["热血", "仙侠", "玄幻", "都市", "冒险", "武侠", "格斗", "科幻", "异能", "重生", "推理", "悬疑", "竞技", "搞笑", "恐怖", "生活", "校园", "恋爱", "百合", "耽美"],
      categoryParams: ["rexue", "xianxia", "xuanhuan", "dushi", "maoxian", "wuxia", "gedou", "kehuan", "yineng", "chongsheng", "tuili", "xuanyi", "jingji", "gaoxiao", "kongbu", "shenghuo", "xiaoyuan", "lianai", "baihe", "danmei"],
      itemType: "category"
    }],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let url = `${this.baseUrl}/manhua/area/${param}/${page}.html`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `分类加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      let items = doc.querySelectorAll(".cell.comic-item");
      return {
        comics: items.map(e => this.parseComic(e)).filter(Boolean),
        maxPage: page + 1
      };
    }
  };

  search = {
    load: async (keyword, options, page) => {
      let url = `${this.baseUrl}/search?q=${encodeURIComponent(keyword)}&page=${page}`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `搜索失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      let items = doc.querySelectorAll(".cell.comic-item, .search-result .comic-item");
      return {
        comics: items.map(e => this.parseComic(e)).filter(Boolean),
        maxPage: page + 1
      };
    }
  };

  comic = {
    loadInfo: async (id) => {
      let url = `${this.baseUrl}/manhua/${id}`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `详情加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      
      let title = doc.querySelector(".metas-title")?.text?.trim() || id;
      let cover = doc.querySelector(".metas-image img")?.attributes?.src || "";
      let author = doc.querySelector(".metas-body .author")?.text?.replace("作者：", "").trim() || "";
      let description = doc.querySelector(".metas-desc p")?.text?.trim() || "";
      let update = doc.querySelector(".newchapter a")?.text?.trim() || "";
      
      // 标签
      let tags = [];
      let tagLinks = doc.querySelectorAll(".metas-body .author a");
      for (let link of tagLinks) {
        let t = link.text.trim();
        if (t && t !== "连载中" && t !== "已完结") tags.push(t);
      }
      let status = doc.querySelector(".metas-body .author .has-text-success")?.text?.trim() || "";
      
      // 章节列表
      let chapters = new Map();
      let chapterLinks = doc.querySelectorAll(".comic-chapters li a");
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
        description, tags: { 作者: [author], 状态: [status], 题材: tags, 更新: [update] },
        chapters, updateTime: update
      });
    },

    loadEp: async (comicId, epId) => {
      // 优先用移动端页面，图片直接在 HTML 中
      let url = `https://m.haoduoman.com/manhua/${comicId}/${epId}.html`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        // 回退 PC 端
        url = `${this.baseUrl}/manhua/${comicId}/${epId}.html`;
        res = await Network.get(url, this.headers);
      }
      if (res.status !== 200) throw `章节加载失败: ${res.status}`;
      
      let html = res.body;
      let images = [];
      
      // 移动端页面：图片通过 JS 动态加载，config 变量包含加密的图片列表
      // 尝试提取 config 变量并解密
      const configMatch = html.match(/var config = '([^']+)';/);
      if (configMatch) {
        try {
          // config 是 crypto-js AES 加密的数据
          // 需要用 crypto-js 解密，这里简化处理
          // 实际需要完整的解密逻辑
        } catch (e) {}
      }
      
      // 回退：DOM 解析懒加载图片
      if (images.length === 0) {
        let doc = new HtmlDocument(res.body);
        let imgNodes = doc.querySelectorAll(".chapter-image img, .chapter-images img, .read-content img");
        for (let img of imgNodes) {
          let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
          if (src && src.includes("img.haoduoman.com")) {
            images.push(this.fixUrl(src));
          }
        }
      }
      
      return { images: images.map(img => this.fixUrl(img)) };
    }
  };
}

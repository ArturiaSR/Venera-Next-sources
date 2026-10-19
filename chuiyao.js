/** @type {import('./_venera_.js')} */
class Chuiyao extends ComicSource {
  name = "吹妖漫画";
  key = "chuiyao";
  version = "1.0.0";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/chuiyao.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "http://m.chuiyao.com", text: "http://m.chuiyao.com (主站)" }
      ],
      default: "http://m.chuiyao.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "http://m.chuiyao.com";
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
    const title = item.querySelector(".title, h3, h4, .book-title")?.text?.trim() || link.text.trim();
    const cover = item.querySelector("img")?.attributes?.src || item.querySelector("img")?.attributes?.["data-src"];
    const author = item.querySelector(".author, .book-author")?.text?.trim() || "";
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
    title: "吹妖漫画",
    type: "multiPartPage",
    load: async (page) => {
      let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      const result = {};
      let items = doc.querySelectorAll(".comic-list li, .book-list li, .comic-item, .list-item, .recommend-item, .cell.comic-item, .manga-1-list-item, .manga-i-list-item, .comics li, article");
      if (items.length > 0) {
        result["推荐漫画"] = items.map(e => this.parseComic(e)).filter(Boolean);
      }
      return result;
    }
  }];

  category = null;

  search = {
    load: async (keyword, options, page) => {
      let url = `${this.baseUrl}/search/${encodeURIComponent(keyword)}/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `搜索失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      let items = doc.querySelectorAll(".comic-list li, .book-list li, .comic-item, .list-item, .cell.comic-item, .manga-1-list-item, .manga-i-list-item, .search-result li, .comics li, article");
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
      
      let title = doc.querySelector(".book-title, h1, .detail-title, .comic-title, .metas-title")?.text?.trim() || id;
      let cover = doc.querySelector(".book-cover img, .detail-cover img, .comic-cover img, .metas-image img, .manga-1-cover img")?.attributes?.src || "";
      let author = doc.querySelector(".book-author, .author, .comic-author, .metas-body .author")?.text?.trim() || "";
      let description = doc.querySelector(".book-intro, .intro, .description, .comic-desc, .metas-desc p")?.text?.trim() || "";
      let update = doc.querySelector(".last-chapter, .update-chapter, .latest-chapter, .manga-1-list-subtitle, .newchapter a")?.text?.trim() || "";
      let status = doc.querySelector(".book-status, .status, .comic-status, .has-text-success")?.text?.trim() || "";
      
      let chapters = new Map();
      let chapterLinks = doc.querySelectorAll("#chapter-list a, .chapter-list a, .catalog a, .comic-chapters a, .book-chapters a, .detail-list a");
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
      let imgNodes = doc.querySelectorAll("#chapter-images img, .chapter-content img, .read-content img, .comic-page img, .manga-1-cover img, .manga-i-cover img, .chapter-images img");
      for (let img of imgNodes) {
        let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
        if (src) images.push(this.fixUrl(src));
      }
      return { images };
    }
  };
}

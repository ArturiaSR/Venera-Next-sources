/** @type {import('./_venera_.js')} */
class Pufeimh extends ComicSource {
  name = "扑飞漫画";
  key = "pufeimh";
  version = "1.0.0";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/pufeimh.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "http://m.pufei.cc", text: "http://m.pufei.cc (主站)" }
      ],
      default: "http://m.pufei.cc"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "http://m.pufei.cc";
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
    const title = item.querySelector("h3, .title, .book-title")?.text?.trim() || link.text.trim();
    const cover = item.querySelector(".image.lazy, img")?.attributes?.src || item.querySelector("img")?.attributes?.src;
    const author = item.querySelector("dl > dd, .author")?.text?.trim() || "";
    const update = item.querySelector("dl:eq(4) > dd, .update, .chapter")?.text?.trim() || "";
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
    title: "扑飞漫画",
    type: "multiPartPage",
    load: async (page) => {
      let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      const result = {};
      let items = doc.querySelectorAll("#detail > li, .comic-list li, .book-list li, .comic-item");
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
      let items = doc.querySelectorAll("#detail > li, .comic-list li, .book-list li, .comic-item");
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
      
      let title = doc.querySelector(".main-bar > h1, .book-title, h1")?.text?.trim() || id;
      let cover = doc.querySelector(".book-detail img, .detail-cover img")?.attributes?.src || "";
      let author = doc.querySelector(".book-detail dl dd, .author")?.text?.trim() || "";
      let description = doc.querySelector("#bookIntro, .intro, .description")?.text?.trim() || "";
      let update = doc.querySelector(".book-detail dl dd, .update, .chapter")?.text?.trim() || "";
      let status = doc.querySelector(".book-detail i, .status")?.text?.trim() || "";
      
      let chapters = new Map();
      let chapterLinks = doc.querySelectorAll("#chapterList2 ul li a, .chapter-list a, .catalog a");
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
      let imgNodes = doc.querySelectorAll("#chapter-images img, .chapter-content img, .read-content img");
      for (let img of imgNodes) {
        let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
        if (src) images.push(this.fixUrl(src));
      }
      return { images };
    }
  };
}

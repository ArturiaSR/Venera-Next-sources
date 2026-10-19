/** @type {import('./_venera_.js')} */
class Bainianmh2 extends ComicSource {
  name = "百年漫画";
  key = "bainianmh2";
  version = "1.0.0";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/bainianmh2.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://m.bnman.net", text: "https://m.bnman.net (主站)" }
      ],
      default: "https://m.bnman.net"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://m.bnman.net";
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
    const title = item.querySelector("h4 > a, .title, h3")?.text?.trim() || link.text.trim();
    const cover = item.querySelector("mip-img, img")?.attributes?.src || item.querySelector("img")?.attributes?.src;
    const author = item.querySelector(".dir, .author")?.text?.trim() || "";
    const update = item.querySelector(".act, .update, .chapter")?.text?.trim() || "";
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
    title: "百年漫画",
    type: "multiPartPage",
    load: async (page) => {
      let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      const result = {};
      let items = doc.querySelectorAll("ul.tbox_m > li, .comic-list li, .book-list li");
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
      let items = doc.querySelectorAll("ul.tbox_m > li, .comic-list li, .book-list li");
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
      
      let title = doc.querySelector(".dbox > .data > h4, .book-title, h1")?.text?.trim() || id;
      let cover = doc.querySelector(".dbox > .img > mip-img, .book-cover img")?.attributes?.src || "";
      let author = doc.querySelector(".dbox > .data > .dir, .author")?.text?.trim() || "";
      let description = doc.querySelector(".tbox_js, .intro, .description")?.text?.trim() || "";
      let update = doc.querySelector(".dbox > .data > .act, .update")?.text?.trim() || "";
      let status = doc.querySelector(".list_item, .status")?.text?.trim() || "";
      
      let chapters = new Map();
      let chapterLinks = doc.querySelectorAll(".tabs_block > ul.list_block > li > a, .chapter-list a");
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

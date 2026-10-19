/** @type {import('./_venera_.js')} */
class Baozi2 extends ComicSource {
  name = "包子漫画";
  key = "baozi2";
  version = "1.0.0";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/baozi2.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://cn.baozimhcn.com", text: "https://cn.baozimhcn.com (主站)" }
      ],
      default: "https://cn.baozimhcn.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://cn.baozimhcn.com";
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
    const title = item.querySelector("h3, .title")?.text?.trim() || link.text.trim();
    const cover = item.querySelector("amp-img, img")?.attributes?.src || item.querySelector("img")?.attributes?.src;
    const author = item.querySelector("small, .author")?.text?.trim() || "";
    const update = item.querySelector("")?.text?.trim() || "";
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
    title: "包子漫画",
    type: "multiPartPage",
    load: async (page) => {
      let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `加载失败: ${res.status}`;
      let doc = new HtmlDocument(res.body);
      const result = {};
      let items = doc.querySelectorAll(".comics-card, .comic-item, .list-item");
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
      let items = doc.querySelectorAll(".comics-card, .comic-item, .list-item");
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
      
      let title = doc.querySelector(".comics-detail__title, .book-title, h1")?.text?.trim() || id;
      let cover = doc.querySelector("amp-img, .book-cover img")?.attributes?.src || "";
      let author = doc.querySelector(".comics-detail__author, .author")?.text?.trim() || "";
      let description = doc.querySelector(".comics-detail__info p, .intro, .description")?.text?.trim() || "";
      let update = doc.querySelector(".comics-detail__info span em, .update")?.text?.trim() || "";
      let status = doc.querySelector(".tag-list span, .status")?.text?.trim() || "";
      
      let chapters = new Map();
      let chapterLinks = doc.querySelectorAll("#chapter-items > div a, #chapters_other_list a, .chapter-list a");
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

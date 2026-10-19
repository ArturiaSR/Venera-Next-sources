/** @type {import('./_venera_.js')} */
class MH160 extends ComicSource {
  name = "漫画160";
  key = "mh160";
  version = "1.0.0";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/mh160.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://www.mh160mh.com", text: "mh160mh.com (主站)" }
      ],
      default: "https://www.mh160mh.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://www.mh160mh.com";
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
      const title = item.querySelector(".mh-comic-title, .title, h3, h4, .book-title")?.text?.trim() || link.text.trim();
      const cover = item.querySelector(".hotcomic-pic img, .mh-comic-works img")?.attributes?.src || item.querySelector("img")?.attributes?.src;
      const author = "";
      const update = item.querySelector(".update, .chapter, .latest")?.text?.trim() || "";
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
      title: "漫画160",
      type: "multiPartPage",
      load: async (page) => {
        let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
        const result = {};
        let items = doc.querySelectorAll(".mh-adventure-list li, .mh-ct .mh-comic-works, .hotcomic-list li, .comic-list li, .book-list li, .comic-item, .list-item, .recommend-item");
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
        let items = doc.querySelectorAll(".search-result li, .book-list li, .comic-item, .mh-comic-works");
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
      
        let title = doc.querySelector(".mh-comic-title, .book-title, h1, .detail-title")?.text?.trim() || id;
        let cover = doc.querySelector(".hotcomic-pic img, .mh-comic-works img, .book-cover img, .detail-cover img")?.attributes?.src || "";
        let author = "";
        let description = doc.querySelector(".book-intro, .intro, .description")?.text?.trim() || "";
        let update = doc.querySelector(".last-chapter, .update-chapter, .mh-comic-works .update")?.text?.trim() || "";
        let status = doc.querySelector(".book-status, .status")?.text?.trim() || "";
      
        let chapters = new Map();
        let chapterLinks = doc.querySelectorAll(".chapter-list a, .book-chapters a, .catalog a, #chapter-list a");
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
          description, tags: { 状态: [status], 更新: [update] },
          chapters, updateTime: update
        });
      },

      loadEp: async (comicId, epId) => {
        let url = `${this.baseUrl}/comic/${comicId}/${epId}.html`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `章节加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
      
        let images = [];
        let imgNodes = doc.querySelectorAll("#chapter-images img, .chapter-content img, .read-content img, .hotcomic-pic img, .mh-comic-works img");
        for (let img of imgNodes) {
          let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
          if (src) images.push(this.fixUrl(src));
        }
        return { images };
      }
    };
}

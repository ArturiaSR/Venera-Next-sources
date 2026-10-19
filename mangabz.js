/** @type {import('./_venera_.js')} */
class Mangabz extends ComicSource {
  name = "Mangabz";
  key = "mangabz";
  version = "1.0.0";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@main/mangabz.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "http://www.mangabz.com", text: "mangabz.com (主站)" }
      ],
      default: "http://www.mangabz.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "http://www.mangabz.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": this.baseUrl + "/"
    };
  }

  parseComic(item) {
      const link = item.querySelector("a");
      if (!link) return null;
      const href = link.attributes.href;
      const id = href.split("/").pop().replace(".html", "");
      const title = item.querySelector(".manga-i-list-title, .index-title, .title, h3, h4")?.text?.trim() || link.text.trim();
      const cover = item.querySelector(".manga-i-cover img, .index-title img")?.attributes?.src || item.querySelector("img")?.attributes?.src;
      const update = item.querySelector(".manga-i-list-subtitle")?.text?.trim() || "";
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
      title: "Mangabz",
      type: "multiPartPage",
      load: async (page) => {
        let url = page === 1 ? this.baseUrl : `${this.baseUrl}/list/0_0_0_0_0_${page}.html`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
        const result = {};
        let items = doc.querySelectorAll(".manga-i-list-item, .comic-list li, .book-list li, .comic-item, .list-item, .comics li");
        if (items.length > 0) {
          result["最新更新"] = items.map(e => this.parseComic(e)).filter(Boolean);
        }
        return result;
      }
    }];

    category = null;

    search = {
      load: async (keyword, options, page) => {
        let url = `${this.baseUrl}/search/${encodeURIComponent(keyword)}/${page}.html`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `搜索失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
        let items = doc.querySelectorAll(".manga-i-list-item, .search-result li, .book-list li, .comic-item, .comics li");
        return {
          comics: items.map(e => this.parseComic(e)).filter(Boolean),
          maxPage: page + 1
        };
      }
    };

  comic = {
      loadInfo: async (id) => {
        let url = `${this.baseUrl}/${id}/`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `详情加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
      
        let title = doc.querySelector(".manga-i-list-title, .index-title, .book-title, h1, .detail-title, .comic-title")?.text?.trim() || id;
        let cover = doc.querySelector(".manga-i-cover img, .index-title img, .book-cover img, .detail-cover img, .comic-cover img")?.attributes?.src || "";
        let author = "";
        let description = doc.querySelector(".book-intro, .intro, .description, .comic-desc")?.text?.trim() || "";
        let update = doc.querySelector(".last-chapter, .update-chapter, .latest-chapter, .manga-i-list-subtitle")?.text?.trim() || "";
        let status = doc.querySelector(".book-status, .status, .comic-status")?.text?.trim() || "";
      
        let chapters = new Map();
        let chapterLinks = doc.querySelectorAll(".chapter-list a, .book-chapters a, .catalog a, .comic-chapters a, #chapter-list a");
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
        let url = `${this.baseUrl}/${comicId}/${epId}.html`;
        let res = await Network.get(url, this.headers);
        if (res.status !== 200) throw `章节加载失败: ${res.status}`;
        let doc = new HtmlDocument(res.body);
      
        let images = [];
        let imgNodes = doc.querySelectorAll("#chapter-images img, .chapter-content img, .read-content img, .comic-page img, .manga-i-cover img, .index-title img");
        for (let img of imgNodes) {
          let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
          if (src) images.push(this.fixUrl(src));
        }
        return { images };
      }
    };
}

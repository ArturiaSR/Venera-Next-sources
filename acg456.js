/** @type {import('./_venera_.js')} */

function fitToRow(list, max = 24) {
  if (!list || !Array.isArray(list) || list.length === 0) return [];
  const limit = Math.min(list.length, max);
  const remainder = limit % 4;
  return list.slice(0, limit - remainder);
}

class Acg456 extends ComicSource {
  name = "ACG456";
  key = "acg456";
  version = "1.0.1";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@acg456-v1.0.1/acg456.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "http://m.acg456.com", text: "http://m.acg456.com (移动端主站)" },
        { value: "https://m.acg456.com", text: "https://m.acg456.com (HTTPS备用)" },
        { value: "http://www.acg456.com", text: "http://www.acg456.com (PC端备用)" }
      ],
      default: "http://m.acg456.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "http://m.acg456.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Referer": this.baseUrl + "/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "http_client": "dart:io"
    };
  }

  checkPageValid(body) {
    if (typeof body !== "string") return false;
    // 检测原站失活重定向与博彩/劫持脚本特征
    if (body.includes("rd6mve0or8j0yzo") || body.includes("_0x354f") || body.includes("w7zmd5wdj")) {
      throw "ACG456 原站点已失效或被劫持（检测到跳转至博彩推广页），请在源设置中切换备用域名或使用替代漫画源。";
    }
    return true;
  }

  parseComic(item) {
    if (!item) return null;
    const link = item.querySelector("a");
    if (!link) return null;
    const href = link.attributes.href || "";
    const id = href.split("/").filter(Boolean).pop()?.replace(".html", "") || "";
    const title = item.querySelector(".title, h3, h4, .book-title")?.text?.trim() || link.text?.trim() || "";
    const cover = item.querySelector("img")?.attributes?.src || item.querySelector("img")?.attributes?.["data-src"] || "";
    const author = item.querySelector(".author, .book-author")?.text?.trim() || "";
    const update = item.querySelector(".update, .chapter, .latest, .manga-1-list-subtitle")?.text?.trim() || "";
    if (!id || !title) return null;
    return new Comic({
      id,
      title,
      subTitle: author,
      cover: this.fixUrl(cover),
      tags: [],
      description: update
    });
  }

  fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("//")) return "https:" + u;
    const base = this.baseUrl.replace(/\/+$/, "");
    return base + "/" + u.replace(/^\/+/, "");
  }

  explore = [{
    title: "ACG456",
    type: "multiPartPage",
    load: async (page) => {
      let url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `加载失败: HTTP ${res.status}`;
      this.checkPageValid(res.body);

      let doc = new HtmlDocument(res.body);
      try {
        const result = {};
        let items = doc.querySelectorAll(".comic-list li, .book-list li, .comic-item, .list-item, .recommend-item, .cell.comic-item, .manga-1-list-item, .manga-i-list-item, .comics li, article");
        let comics = items.map(e => this.parseComic(e)).filter(Boolean);
        if (comics.length > 0) {
          result["推荐漫画"] = fitToRow(comics, 24);
        }
        return result;
      } finally {
        doc.dispose();
      }
    }
  }];

  category = null;

  search = {
    load: async (keyword, options, page) => {
      const kw = (keyword || "").trim();
      if (!kw) return { comics: [], maxPage: 1 };

      let url = `${this.baseUrl}/search/${encodeURIComponent(kw)}/${page}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `搜索失败: HTTP ${res.status}`;
      this.checkPageValid(res.body);

      // 无搜索结果提示防误触
      if (res.body.includes("暫無漫畫") || res.body.includes("暂无漫画") || res.body.includes("没有找到相关的漫画")) {
        return { comics: [], maxPage: 1 };
      }

      let doc = new HtmlDocument(res.body);
      try {
        let items = doc.querySelectorAll(".comic-list li, .book-list li, .comic-item, .list-item, .cell.comic-item, .manga-1-list-item, .manga-i-list-item, .search-result li, .comics li, article");
        let comics = items.map(e => this.parseComic(e)).filter(Boolean);
        
        let pagination = doc.querySelectorAll(".pagination a, .pages a, .pager a");
        let maxPage = page;
        if (pagination.length > 0) {
          for (let p of pagination) {
            let n = parseInt(p.text.trim());
            if (!isNaN(n) && n > maxPage) {
              maxPage = n;
            }
          }
        } else if (comics.length >= 10) {
          maxPage = page + 1;
        }

        return {
          comics,
          maxPage: Math.max(1, maxPage)
        };
      } finally {
        doc.dispose();
      }
    }
  };

  comic = {
    loadInfo: async (id) => {
      let url = `${this.baseUrl}/comic/${id}/`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `详情加载失败: HTTP ${res.status}`;
      this.checkPageValid(res.body);

      let doc = new HtmlDocument(res.body);
      try {
        let title = doc.querySelector(".book-title, h1, .detail-title, .comic-title, .metas-title")?.text?.trim() || id;
        let cover = doc.querySelector(".book-cover img, .detail-cover img, .comic-cover img, .metas-image img, .manga-1-cover img")?.attributes?.src || "";
        let author = doc.querySelector(".book-author, .author, .comic-author, .metas-body .author")?.text?.trim() || "未知作者";
        let description = doc.querySelector(".book-intro, .intro, .description, .comic-desc, .metas-desc p")?.text?.trim() || "";
        let update = doc.querySelector(".last-chapter, .update-chapter, .latest-chapter, .manga-1-list-subtitle, .newchapter a")?.text?.trim() || "";
        let status = doc.querySelector(".book-status, .status, .comic-status, .has-text-success")?.text?.trim() || "连载中";

        let chapters = new Map();
        let chapterLinks = doc.querySelectorAll("#chapter-list a, .chapter-list a, .catalog a, .comic-chapters a, .book-chapters a, .detail-list a");
        for (let link of chapterLinks) {
          let href = link.attributes.href || "";
          let cid = href.split("/").filter(Boolean).pop()?.replace(".html", "");
          let ctitle = link.text?.trim();
          if (cid && ctitle) {
            chapters.set(cid, ctitle);
          }
        }

        return new ComicDetails({
          title,
          cover: this.fixUrl(cover),
          description,
          tags: {
            "作者": [author],
            "状态": [status],
            "更新": [update]
          },
          chapters,
          updateTime: update
        });
      } finally {
        doc.dispose();
      }
    },

    loadEp: async (comicId, epId) => {
      let url = `${this.baseUrl}/comic/${comicId}/${epId}.html`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `章节加载失败: HTTP ${res.status}`;
      this.checkPageValid(res.body);

      let doc = new HtmlDocument(res.body);
      try {
        let images = [];
        let imgNodes = doc.querySelectorAll("#chapter-images img, .chapter-content img, .read-content img, .comic-page img, .manga-1-cover img, .manga-i-cover img, .chapter-images img");
        for (let img of imgNodes) {
          let src = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"] || "";
          if (src) {
            images.push(this.fixUrl(src));
          }
        }
        return { images };
      } finally {
        doc.dispose();
      }
    },

    onImageLoad: (url, comicId, epId) => ({
      url,
      headers: this.headers
    }),

    onThumbnailLoad: (url) => ({
      url,
      headers: this.headers
    })
  };
}

/** @type {import('./_venera_.js')} */

function fitToRow(list, max = 28) {
  if (!list || list.length === 0) return [];
  const count = Math.min(list.length, max);
  const rows = Math.floor(count / 4);
  return list.slice(0, Math.max(rows * 4, 4));
}

function isCloudflareChallenge(status, body) {
  if (status === 403 || status === 503) {
    if (
      body &&
      (body.indexOf("challenge-platform") !== -1 ||
        body.indexOf("cf-browser-verification") !== -1 ||
        body.indexOf("Just a moment") !== -1 ||
        body.indexOf("__cf_chl_") !== -1)
    ) {
      return true;
    }
    return true;
  }
  return false;
}

class Dmzj extends ComicSource {
  name = "动漫之家";
  key = "dmzj";
  version = "1.0.1";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@dmzj-v1.0.1/dmzj.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://m.dmzj.com", text: "https://m.dmzj.com (原官方主站-已关停)" }
      ],
      default: "https://m.dmzj.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://m.dmzj.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Referer": this.baseUrl + "/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    };
  }

  async fetch(url) {
    try {
      const res = await Network.get(url, this.headers);
      if (isCloudflareChallenge(res.status, res.body)) {
        throw "Cloudflare 5秒盾验证拦截：请在设置中通过 Webview 完成验证。";
      }
      if (res.status !== 200) {
        throw `请求失败 (HTTP ${res.status})`;
      }
      return res;
    } catch (e) {
      if (typeof e === "string" && (e.includes("Failed to connect") || e.includes("Connection refused") || e.includes("handshake"))) {
        throw "动漫之家 (DMZJ) 官方服务器已于2025年关停下线，当前网络无法连通。建议在源管理中使用拷贝漫画、包子漫画等替代源。";
      }
      throw e;
    }
  }

  parseComic(item) {
    if (!item) return null;
    const link = item.querySelector("a");
    if (!link || !link.attributes) return null;
    const href = link.attributes.href || "";
    const idMatch = href.match(/\/(\d+)\.html/) || href.split("/").filter(Boolean).slice(-1);
    const id = idMatch ? idMatch[0].replace(/[\/\.html]/g, "") : "";
    const title = item.querySelector(".title, h3, h4, .book-title, .name")?.text?.trim() || link.text?.trim() || "";
    const imgEl = item.querySelector("img");
    const cover = imgEl?.attributes?.["data-src"] || imgEl?.attributes?.["data-original"] || imgEl?.attributes?.src || "";
    const author = item.querySelector(".author, .book-author")?.text?.trim() || "";
    const update = item.querySelector(".update, .chapter, .latest")?.text?.trim() || "";

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
    return this.baseUrl.replace(/\/$/, "") + "/" + u.replace(/^\//, "");
  }

  explore = [
    {
      title: "动漫之家",
      type: "multiPartPage",
      load: async (page) => {
        const url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
        const res = await this.fetch(url);
        const doc = new HtmlDocument(res.body);
        try {
          const result = {};
          const items = doc.querySelectorAll(".comic-list li, .book-list li, .comic-item, .list-item, .item");
          if (items && items.length > 0) {
            const parsed = items.map((e) => this.parseComic(e)).filter(Boolean);
            if (parsed.length > 0) {
              result["推荐漫画"] = fitToRow(parsed, 28);
            }
          }
          return result;
        } finally {
          doc.dispose();
        }
      }
    }
  ];

  category = {
    title: "动漫之家",
    parts: [
      {
        name: "分类",
        type: "fixed",
        categories: ["全部"],
        itemType: "category",
        categoryParams: ["/category"]
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const url = `${this.baseUrl}${param || "/category"}/${page}.html`;
      const res = await this.fetch(url);
      const doc = new HtmlDocument(res.body);
      try {
        const items = doc.querySelectorAll(".comic-list li, .book-list li, .comic-item, .list-item");
        const comics = items.map((e) => this.parseComic(e)).filter(Boolean);

        const pageLinks = doc.querySelectorAll(".pagination a, .pages a");
        let maxPage = page;
        for (let l of pageLinks) {
          const num = parseInt(l.text?.trim() || "");
          if (!isNaN(num) && num > maxPage) {
            maxPage = num;
          }
        }
        return {
          comics,
          maxPage: Math.max(maxPage, page)
        };
      } finally {
        doc.dispose();
      }
    }
  };

  search = {
    load: async (keyword, options, page) => {
      if (!keyword || !keyword.trim()) {
        return { comics: [], maxPage: 1 };
      }
      const trimmed = keyword.trim();
      const url = `${this.baseUrl}/search/${encodeURIComponent(trimmed)}/${page}/`;
      const res = await this.fetch(url);

      if (
        res.body.includes("暂无漫画") ||
        res.body.includes("暫無漫畫") ||
        res.body.includes("无搜索结果") ||
        res.body.includes("未找到相关")
      ) {
        return { comics: [], maxPage: 1 };
      }

      const doc = new HtmlDocument(res.body);
      try {
        const items = doc.querySelectorAll(".comic-list li, .book-list li, .comic-item, .list-item");
        const comics = items.map((e) => this.parseComic(e)).filter(Boolean);
        return {
          comics,
          maxPage: comics.length > 0 ? page + 1 : page
        };
      } finally {
        doc.dispose();
      }
    }
  };

  comic = {
    onImageLoad: (url, comicId, epId) => {
      return {
        url,
        headers: this.headers
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url,
        headers: this.headers
      };
    },

    loadInfo: async (id) => {
      const url = `${this.baseUrl}/comic/${id}/`;
      const res = await this.fetch(url);
      const doc = new HtmlDocument(res.body);
      try {
        const title = doc.querySelector(".book-title, h1, .detail-title")?.text?.trim() || id;
        const cover = doc.querySelector(".book-cover img, .detail-cover img")?.attributes?.src || "";
        const author = doc.querySelector(".book-author, .author")?.text?.trim() || "";
        const description = doc.querySelector(".book-intro, .intro, .description")?.text?.trim() || "";
        const update = doc.querySelector(".last-chapter, .update-chapter")?.text?.trim() || "";
        const status = doc.querySelector(".book-status, .status")?.text?.trim() || "";

        const chapters = new Map();
        const chapterLinks = doc.querySelectorAll("#chapter-list a, .chapter-list a, .catalog a, .comic-chapters a");
        let i = 0;
        for (let link of chapterLinks) {
          const href = link.attributes?.href || "";
          const cidMatch = href.match(/\/(\d+)\.html/) || href.split("/").filter(Boolean).slice(-1);
          const cid = cidMatch ? cidMatch[0].replace(/[\/\.html]/g, "") : "";
          const ctitle = link.text?.trim() || "";
          if (cid && ctitle) {
            chapters.set(cid, ctitle);
            i++;
          }
        }

        return new ComicDetails({
          title,
          cover: this.fixUrl(cover),
          description,
          tags: {
            作者: author ? [author] : [],
            状态: status ? [status] : [],
            更新: update ? [update] : []
          },
          chapters,
          updateTime: update
        });
      } finally {
        doc.dispose();
      }
    },

    loadEp: async (comicId, epId) => {
      const url = `${this.baseUrl}/comic/${comicId}/${epId}.html`;
      const res = await this.fetch(url);
      const doc = new HtmlDocument(res.body);
      try {
        const images = [];
        const imgNodes = doc.querySelectorAll("#chapter-images img, .chapter-content img, .read-content img, .comic-page img");
        for (let img of imgNodes) {
          const src =
            img.attributes?.["data-src"] ||
            img.attributes?.["data-original"] ||
            img.attributes?.src ||
            "";
          if (src) images.push(this.fixUrl(src));
        }
        return { images };
      } finally {
        doc.dispose();
      }
    }
  };
}

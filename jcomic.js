/** @type {import('./_venera_.js')} */

const JCOMIC_BASE = "https://jcomic.net";
const JCOMIC_REFERER = JCOMIC_BASE + "/";

const defaultHeaders = {
  "Referer": JCOMIC_REFERER,
  "Cookie": "jcomic_access=verified_user",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

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
  }
  return false;
}

async function fetchWithCFCheck(url, headers = defaultHeaders) {
  const resp = await Network.get(url, headers);
  if (isCloudflareChallenge(resp.status, resp.body)) {
    throw "Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成验证后再试。";
  }
  return resp;
}

function trimTitle(raw) {
  if (!raw) return "";
  const idx = raw.lastIndexOf(" (");
  if (idx > 0) return raw.slice(0, idx).trim();
  return raw.trim();
}

function parseIdFromHref(href) {
  if (!href) return null;
  try {
    const u = href.split("?")[0];
    const parts = u.split("/").filter(Boolean); // 过滤空字符串
    if (parts.length >= 2) {
      return decodeURIComponent(parts[1]);
    }
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

function parseEpIdFromHref(href) {
  if (!href) return null;
  try {
    const u = href.split("?")[0];
    const parts = u.split("/").filter(Boolean);
    if (parts.length >= 3) {
      return decodeURIComponent(parts[2]);
    }
  } catch {}
  return null;
}

function base64Decode(str) {
  try {
    if (typeof Convert !== "undefined" && Convert.decodeBase64 && Convert.decodeUtf8) {
      return Convert.decodeUtf8(Convert.decodeBase64(str));
    }
    if (typeof atob === "function") {
      return atob(str);
    }
  } catch (e) {}

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  str = String(str).replace(/=+$/, "");
  for (let bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
    buffer = chars.indexOf(buffer);
    if (~buffer) {
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }
  return output;
}

/**
 * 解析作品卡片 -> Comic
 * @param {Element} card
 */
function parseComicCard(card) {
  try {
    const link = card.querySelector('a[href^="/eps/"], a[href^="/page/"]');
    if (!link) return null;
    const href = link.attributes["href"];
    const id = parseIdFromHref(href);
    if (!id) return null;

    const img = card.querySelector("img.comic-thumb");
    let cover = img ? (img.attributes["src"] || img.attributes["data-src"] || "") : "";
    if (cover.startsWith("//")) {
      cover = "https:" + cover;
    } else if (cover.startsWith("/")) {
      cover = JCOMIC_BASE + cover;
    }

    const titleEl = card.querySelector("p.comic-title");
    const rawTitle = titleEl ? titleEl.text.trim() : id;
    const title = trimTitle(rawTitle);

    // 作者
    const authorButtons = card.querySelectorAll('a[href^="/author/"] button');
    const authors = Array.from(authorButtons).map((b) => b.text.trim());
    const subTitle = authors.join(" ");

    // 分类标签
    const catButtons = card.querySelectorAll('a[href^="/cat/"] button');
    let tags = [];
    if (catButtons.length) {
      tags = Array.from(catButtons).map((b) => b.text.trim());
    } else {
      const catAnchors = card.querySelectorAll('a[href^="/cat/"]');
      tags = Array.from(catAnchors)
        .map((a) => a.text.trim())
        .filter(Boolean);
    }

    // 最后更新
    const dateEl = card.querySelector("p.comic-date");
    const description = dateEl ? dateEl.text.trim() : "";

    return new Comic({
      id,
      title,
      subTitle,
      cover,
      tags,
      language: "zh-Hant",
      description,
    });
  } catch (e) {
    return null;
  }
}

/**
 * 通用：解析分页最大页数
 * @param {HtmlDocument} doc
 */
function parseMaxPage(doc) {
  const pag = doc.querySelector("ul.pagination");
  if (!pag) return 1;
  const as = pag.querySelectorAll("a");
  let max = 1;
  as.forEach((a) => {
    const t = a.text.trim();
    const n = parseInt(t, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max;
}

/**
 * 通用：解析列表页所有作品
 * @param {HtmlDocument} doc
 */
function parseComicList(doc) {
  const cards = doc.querySelectorAll(
    'div.row.col-lg-4.col-md-6.col-xs-12, div.row.col-md-6.col-xs-12'
  );
  const result = [];
  cards.forEach((card) => {
    const c = parseComicCard(card);
    if (c) result.push(c);
  });
  return result;
}

class JComic extends ComicSource {
  name = "JComic";
  key = "jcomic";

  version = "1.0.3";
  minAppVersion = "1.4.6";

  url =
    "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@jcomic-v1.0.3/jcomic.js";

  _buildUrl(path) {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!path.startsWith("/")) path = "/" + path;
    return JCOMIC_BASE + path;
  }

  init() {}

  account = {
    loginWithWebview: {
      url: JCOMIC_BASE,
      checkStatus: (url, title) => {
        return (
          !title.includes("Just a moment") &&
          !title.includes("Cloudflare") &&
          !title.includes("Attention Required")
        );
      },
      onLoginSuccess: () => {},
    },
  };

  /// explore
  explore = [
    {
      title: "JComic",
      type: "multiPageComicList",
      load: async (page) => {
        if (!page) page = 1;
        const cat = "最近更新";
        const encoded = encodeURIComponent(cat);
        const path = page === 1 ? `/cat/${encoded}` : `/cat/${encoded}/${page}`;
        const url = this._buildUrl(path);

        const resp = await fetchWithCFCheck(url);
        if (resp.status !== 200) throw new Error(resp.status);

        const doc = new HtmlDocument(resp.body);
        try {
          const comics = parseComicList(doc);
          const maxPage = parseMaxPage(doc);
          return { comics, maxPage };
        } finally {
          doc.dispose();
        }
      },
    },
  ];

  // 分类列表
  category = {
    title: "JComic",
    parts: [
      {
        name: "分類",
        type: "fixed",
        categories: [
          "最近更新",
          "隨機",
          "全彩",
          "長篇",
          "單行本",
          "同人",
          "短篇",
          "Cosplay",
          "歐美",
          "WEBTOON",
          "圓神領域",
          "碧藍幻想",
          "CG雜圖",
          "英語 ENG",
          "生肉",
          "純愛",
          "百合花園",
          "耽美花園",
          "偽娘哲學",
          "後宮閃光",
          "扶他樂園",
          "姐姐系",
          "妹妹系",
          "SM",
          "性轉換",
          "足の恋",
          "重口地帶",
          "人妻",
          "NTR",
          "強暴",
          "非人類",
          "艦隊收藏",
          "Love Live",
          "SAO 刀劍神域",
          "Fate",
          "東方",
          "禁書目錄",
        ],
        itemType: "category",
        categoryParams: [
          "最近更新",
          "隨機",
          "全彩",
          "長篇",
          "單行本",
          "同人",
          "短篇",
          "Cosplay",
          "歐美",
          "WEBTOON",
          "圓神領域",
          "碧藍幻想",
          "CG雜圖",
          "英語 ENG",
          "生肉",
          "純愛",
          "百合花園",
          "耽美花園",
          "偽娘哲學",
          "後宮閃光",
          "扶他樂園",
          "姐姐系",
          "妹妹系",
          "SM",
          "性轉換",
          "足の恋",
          "重口地帶",
          "人妻",
          "NTR",
          "強暴",
          "非人類",
          "艦隊收藏",
          "Love Live",
          "SAO 刀劍神域",
          "Fate",
          "東方",
          "禁書目錄",
        ],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    /**
     * @param category {string}
     * @param param {string} 
     * @param options {string[]}
     * @param page {number}
     */
    load: async (category, param, options, page) => {
      if (!page) page = 1;
      const encoded = encodeURIComponent(param);
      const path = page === 1 ? `/cat/${encoded}` : `/cat/${encoded}/${page}`;
      const url = this._buildUrl(path);

      const resp = await fetchWithCFCheck(url);
      if (resp.status !== 200) throw new Error(resp.status);

      const doc = new HtmlDocument(resp.body);
      try {
        const comics = parseComicList(doc);
        const maxPage = parseMaxPage(doc);
        return { comics, maxPage };
      } finally {
        doc.dispose();
      }
    },
    optionList: [],
    ranking: null,
  };

  /// 搜索
  search = {
    /**
     * @param keyword {string}
     * @param options {string[]}
     * @param page {number}
     */
    load: async (keyword, options, page) => {
      if (!page) page = 1;
      const kw = (keyword || "").trim();
      if (!kw) {
        return { comics: [], maxPage: 1 };
      }
      const encoded = encodeURIComponent(kw);
      const path = page === 1 ? `/search/${encoded}` : `/search/${encoded}/${page}`;
      const url = this._buildUrl(path);

      const resp = await fetchWithCFCheck(url);
      if (resp.status !== 200) throw new Error(resp.status);

      if (resp.body.includes("找到0本相關本子") || resp.body.includes("找到0本")) {
        return { comics: [], maxPage: 1 };
      }

      const doc = new HtmlDocument(resp.body);
      try {
        const comics = parseComicList(doc);
        const maxPage = parseMaxPage(doc);
        return { comics, maxPage };
      } finally {
        doc.dispose();
      }
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  /// 单本漫画
  comic = {
    /**
     * 载入漫画信息和章节列表
     * @param id {string} - 原始标题字符串
     * @returns {Promise<ComicDetails>}
     */
    loadInfo: async (id) => {
      const encodedId = encodeURIComponent(id);
      const url = this._buildUrl(`/eps/${encodedId}`);
      const resp = await fetchWithCFCheck(url);
      if (resp.status !== 200) throw new Error(resp.status);

      const doc = new HtmlDocument(resp.body);
      try {
        const infoBlock =
          doc.querySelector("div.row.col-md-6.col-xs-12") || doc;

        // 标题和总页数
        const titleEl =
          infoBlock.querySelector("p.comic-title") ||
          doc.querySelector("p.comic-title");
        const rawTitle = titleEl ? titleEl.text.trim() : id;
        const title = trimTitle(rawTitle);
        let totalPages = 1;
        const pageMatch = /\((\d+)\)/.exec(rawTitle);
        if (pageMatch) {
          totalPages = parseInt(pageMatch[1], 10) || 1;
        }

        // 封面
        const img =
          infoBlock.querySelector("img.comic-thumb") ||
          doc.querySelector("img.comic-thumb");
        let cover = img ? (img.attributes["src"] || img.attributes["data-src"] || "") : "";
        if (cover.startsWith("//")) {
          cover = "https:" + cover;
        } else if (cover.startsWith("/")) {
          cover = JCOMIC_BASE + cover;
        }

        // 作者
        const authorButtons = infoBlock.querySelectorAll(
          'a[href^="/author/"] button'
        );
        const authors = Array.from(authorButtons).map((b) => b.text.trim());

        // 分类标签
        const catButtons = infoBlock.querySelectorAll('a[href^="/cat/"] button');
        let categories = [];
        if (catButtons.length) {
          categories = Array.from(catButtons).map((b) => b.text.trim());
        } else {
          const catAnchors = infoBlock.querySelectorAll('a[href^="/cat/"]');
          categories = Array.from(catAnchors)
            .map((a) => a.text.trim())
            .filter(Boolean);
        }

        // 更新时间
        const dateEl =
          infoBlock.querySelector("p.comic-date") ||
          doc.querySelector("p.comic-date");
        const uploadTime = dateEl ? dateEl.text.trim() : "";

        // 章节列表
        const allPageLinks = doc.querySelectorAll('a[href^="/page/"]');
        let eps = [];

        allPageLinks.forEach((a) => {
          const href = a.attributes["href"];
          const linkComicId = parseIdFromHref(href);
          if (linkComicId === id) {
            const epId = parseEpIdFromHref(href);
            if (epId) {
              let text = a.text.trim();
              if (!text) {
                const btn = a.querySelector("button");
                if (btn) text = btn.text.trim();
              }
              eps.push({
                id: epId,
                title: text || `第${epId}話`,
              });
            }
          }
        });

        // 兜底：若短篇单行本页面无章节拆分按钮，补充默认单话
        if (eps.length === 0) {
          eps.push({
            id: "1",
            title: "全一話",
          });
        }

        // tags Map
        const tags = new Map();
        if (authors.length) tags.set("作者", authors);
        if (categories.length) tags.set("分類", categories);

        // 构建 chapters Map
        const chapters = new Map();
        eps.forEach((ep) => {
          chapters.set(ep.id, ep.title);
        });

        return new ComicDetails({
          title,
          cover,
          tags,
          chapters,
          maxPage: totalPages,
          thumbnails: [cover],
          uploadTime,
          url: url,
          recommend: undefined,
        });
      } finally {
        doc.dispose();
      }
    },

    /**
     * 载入章节图片
     * @param comicId {string}
     * @param epId {string}
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      const encodedComicId = encodeURIComponent(comicId);
      let path = `/page/${encodedComicId}`;
      if (epId) {
        path += "/" + encodeURIComponent(epId);
      }
      const url = JCOMIC_BASE + path;

      const resp = await fetchWithCFCheck(url);
      if (resp.status !== 200) throw new Error(resp.status);

      const doc = new HtmlDocument(resp.body);
      try {
        const imgs = doc.querySelectorAll("img.comic-thumb, img.jcomic-img");
        const images = [];

        for (const img of imgs) {
          let imgUrl = "";
          const lockedStr = img.attributes["data-locked"];
          if (lockedStr) {
            try {
              const cleanStr = lockedStr.replace("JCOMIC_TRAPS_", "");
              const unreversed = cleanStr.split("").reverse().join("");
              imgUrl = base64Decode(unreversed);
            } catch (e) {}
          }
          if (!imgUrl) {
            imgUrl = img.attributes["src"] || img.attributes["data-src"] || "";
          }
          if (imgUrl) {
            if (imgUrl.startsWith("//")) {
              imgUrl = "https:" + imgUrl;
            } else if (imgUrl.startsWith("/")) {
              imgUrl = JCOMIC_BASE + imgUrl;
            }
            images.push(imgUrl);
          }
        }

        return { images };
      } finally {
        doc.dispose();
      }
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url,
        headers: defaultHeaders,
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url,
        headers: defaultHeaders,
      };
    },

    onClickTag: (namespace, tag) => {
      if (namespace === "作者" || namespace === "authors") {
        return {
          page: "search",
          attributes: {
            keyword: tag,
          },
        };
      }
      return {
        page: "category",
        attributes: {
          category: "分類",
          param: tag,
        },
      };
    },

    link: {
      domains: ["jcomic.net"],
      linkToId: (url) => {
        const reg = /https?:\/\/jcomic\.net\/(?:eps|page)\/([^\/?#]+)(?:\/[^\/?#]+)?/;
        const m = reg.exec(url);
        if (!m) throw new Error("Invalid jcomic url");
        return decodeURIComponent(m[1]);
      },
    },
  };
}
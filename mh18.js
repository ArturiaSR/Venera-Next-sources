/** @type {import('./_venera_.js')} */
class MH18 extends ComicSource {
  // 源名称
  name = "18漫画"

  // 源唯一标识
  key = "mh18"

  version = "1.1.1"

  minAppVersion = "1.4.0"

  // 更新地址 (必须锁定携带源前缀的 Git Tag，严禁使用 @main)
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@mh18-v1.1.1/mh18.js"

  settings = {
    domains: {
      title: "域名",
      type: "input",
      default: "18mh.org"
    }
  }

  get baseUrl() {
    let domain = "18mh.org";
    try {
      domain = this.loadSetting("domains") || "18mh.org";
    } catch (_) {
      domain = "18mh.org";
    }
    const cleanDomain = String(domain).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${cleanDomain}`;
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
      "Referer": `${this.baseUrl}/`,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    };
  }

  /**
   * 补全图片/链接为完整绝对 URL
   */
  normalizeUrl(url) {
    if (!url) return "";
    let u = url.trim();
    if (u.startsWith("//")) return "https:" + u;
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/")) return `${this.baseUrl}${u}`;
    return `${this.baseUrl}/${u}`;
  }

  /**
   * 裁剪单行 4 项对齐，避免末行悬空空白
   */
  fitToRow(list, max = 28) {
    if (!list || list.length === 0) return [];
    const count = Math.min(list.length, max);
    const rows = Math.floor(count / 4);
    return list.slice(0, Math.max(rows * 4, 4));
  }

  /**
   * 检测 Cloudflare 拦截
   */
  isCloudflareChallenge(status, body) {
    if (status === 403 || status === 503) {
      if (body && (
        body.indexOf("challenge-platform") !== -1 ||
        body.indexOf("cf-browser-verification") !== -1 ||
        body.indexOf("Just a moment") !== -1 ||
        body.indexOf("__cf_chl_") !== -1
      )) {
        return true;
      }
    }
    return false;
  }

  /**
   * 统一网络请求与 Cloudflare 拦截防御
   */
  async fetchWithCFCheck(url) {
    const res = await Network.get(url, this.headers);
    if (this.isCloudflareChallenge(res.status, res.body)) {
      throw "Cloudflare 验证拦截：请在漫画源设置中点击「登录」，通过内置浏览器完成验证后再试。";
    }
    return res;
  }

  /**
   * 健壮解析最大页码（防御 NaN 问题）
   */
  parseMaxPage(doc) {
    try {
      const buttons = doc.querySelectorAll("button.text-small");
      if (!buttons || buttons.length === 0) return 1;
      const lastBtn = buttons[buttons.length - 1];
      if (!lastBtn || !lastBtn.text) return 1;
      const parsed = parseInt(lastBtn.text.replaceAll("\n", "").trim());
      return !isNaN(parsed) && parsed > 0 ? parsed : 1;
    } catch (_) {
      return 1;
    }
  }

  /**
   * 解析漫画列表卡片（带空安全防护与多封面属性解析）
   */
  parseComics(doc) {
    if (!doc) return [];
    const result = [];
    const items = doc.querySelectorAll(".pb-2");
    for (let item of items) {
      const a = item.querySelector("a");
      const h3 = item.querySelector("h3");
      const img = item.querySelector("img");
      if (!a || !h3) continue;

      const href = a.attributes ? a.attributes["href"] : "";
      const title = h3.text ? h3.text.trim() : "";
      let cover = "";
      if (img && img.attributes) {
        cover = img.attributes["data-src"] || img.attributes["src"] || "";
      }
      if (!href || !title) continue;

      result.push(new Comic({
        id: href,
        title: title,
        cover: this.normalizeUrl(cover)
      }));
    }
    return result;
  }

  // ==========================================
  // 账号系统与 Cloudflare Webview 验证绕过通道
  // ==========================================
  account = {
    loginWithWebview: {
      url: "https://18mh.org",
      checkStatus: (url, title) => {
        return Boolean(title && !title.includes("Just a moment") && !title.includes("Attention Required") && !title.includes("Cloudflare"));
      }
    }
  }

  // ==========================================
  // 发现页 (explore)
  // ==========================================
  explore = [
    {
      title: this.name,
      type: "multiPartPage",

      load: async () => {
        const res = await this.fetchWithCFCheck(this.baseUrl);
        if (res.status !== 200) {
          throw `Invalid status code: ${res.status}`;
        }
        const document = new HtmlDocument(res.body);
        try {
          const result = [];
          const pbUnit = document.querySelector(".pb-unit-md");
          if (pbUnit) {
            const recentComics = [];
            const slicardas = pbUnit.querySelectorAll(".slicarda");
            for (let item of slicardas) {
              const href = item.attributes ? item.attributes["href"] : "";
              const h3 = item.querySelector("h3");
              const img = item.querySelector("img");
              const title = h3 ? h3.text.trim() : "";
              let cover = "";
              if (img && img.attributes) {
                cover = img.attributes["data-src"] || img.attributes["src"] || "";
              }
              if (href && title) {
                recentComics.push(new Comic({
                  id: href,
                  title: title,
                  cover: this.normalizeUrl(cover)
                }));
              }
            }
            if (recentComics.length > 0) {
              result.push({
                title: "近期更新",
                comics: this.fitToRow(recentComics, 28),
                viewMore: null
              });
            }
          }

          const cardlists = document.querySelectorAll(".cardlist");
          const hometitles = document.querySelectorAll(".hometitle");
          const minLen = Math.min(cardlists.length, hometitles.length);
          for (let i = 0; i < minLen; i++) {
            const h2 = hometitles[i].querySelector("h2");
            const partTitle = h2 ? h2.text.trim() : `推荐 ${i + 1}`;
            const comics = this.parseComics(cardlists[i]);
            const href = hometitles[i].attributes ? hometitles[i].attributes["href"] : null;
            result.push({
              title: partTitle,
              comics: this.fitToRow(comics, 28),
              viewMore: href ? {
                page: "category",
                attributes: {
                  category: partTitle,
                  param: href
                }
              } : null
            });
          }
          return result;
        } finally {
          document.dispose();
        }
      }
    }
  ]

  // ==========================================
  // 分类与筛选 (category & categoryComics)
  // ==========================================
  category = {
    title: this.name,
    parts: [
      {
        name: "类型",
        type: "fixed",
        categories: [
          "全部",
          "韓漫",
          "真人寫真",
          "日漫",
          "AI寫真",
          "熱門漫畫"
        ],
        itemType: "category",
        categoryParams: [
          "/manga",
          "/manga-genre/hanman",
          "/manga-genre/zhenrenxiezhen",
          "/manga-genre/riman",
          "/manga-genre/aixiezhen",
          "/manga-genre/hots"
        ],
      },
      {
        name: "标签",
        type: "fixed",
        categories: [
          "多人",
          "慾望",
          "正妹",
          "同居",
          "女學生",
          "劇情",
          "偷情",
          "校园",
          "逆襲",
          "办公室",
          "誘惑",
          "反转",
          "熟女",
          "人妻",
          "初戀",
          "少妇",
          "刺激",
          "女大学生",
          "治疗",
          "超能力",
          "浪漫校园",
          "戏剧",
          "学姐",
          "大学生",
          "泳衣",
          "暧昧",
          "写真",
          "女神",
          "大尺度",
          "纯情警察"
        ],
        itemType: "category",
        categoryParams: [
          "/manga-tag/duoren",
          "/manga-tag/yuwang",
          "/manga-tag/zhengmei",
          "/manga-tag/tongju",
          "/manga-tag/nxuesheng",
          "/manga-tag/juqing",
          "/manga-tag/touqing",
          "/manga-tag/xiaoyuan",
          "/manga-tag/nixi",
          "/manga-tag/bangongshi",
          "/manga-tag/youhuo",
          "/manga-tag/fanzhuan",
          "/manga-tag/shun",
          "/manga-tag/renqi",
          "/manga-tag/chulian",
          "/manga-tag/shaofu",
          "/manga-tag/ciji",
          "/manga-tag/ndaxuesheng",
          "/manga-tag/zhiliao",
          "/manga-tag/chaonengli",
          "/manga-tag/langmanxiaoyuan",
          "/manga-tag/xiju",
          "/manga-tag/xuejie",
          "/manga-tag/daxuesheng",
          "/manga-tag/yongyi",
          "/manga-tag/aimei",
          "/manga-tag/xiezhen",
          "/manga-tag/nshen",
          "/manga-tag/dachidu",
          "/manga-tag/chunqingjingcha"
        ],
      }
    ],
    enableRankingPage: false,
  }

  categoryComics = {
    load: async (category, params, options, page) => {
      const url = `${this.baseUrl}${params}/page/${page}`;
      const res = await this.fetchWithCFCheck(url);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      try {
        return {
          comics: this.parseComics(document),
          maxPage: this.parseMaxPage(document)
        };
      } finally {
        document.dispose();
      }
    }
  }

  // ==========================================
  // 搜索模块 (search)
  // ==========================================
  search = {
    load: async (keyword, options, page) => {
      if (!keyword || !keyword.trim()) {
        return { comics: [], maxPage: 1 };
      }
      const trimmed = keyword.trim();
      const url = `${this.baseUrl}/s/${encodeURIComponent(trimmed)}?page=${page}`;
      const res = await this.fetchWithCFCheck(url);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }

      // 避坑：检测原站无结果时的推荐漫画假结果污染
      if (
        res.body.includes("暫無漫畫") ||
        res.body.includes("暂无漫画") ||
        res.body.includes("无搜索结果") ||
        res.body.includes("沒有找到") ||
        res.body.includes("请输入关键字") ||
        res.body.includes("請輸入關鍵字")
      ) {
        return { comics: [], maxPage: 1 };
      }

      const document = new HtmlDocument(res.body);
      try {
        return {
          comics: this.parseComics(document),
          maxPage: this.parseMaxPage(document)
        };
      } finally {
        document.dispose();
      }
    },
    enableTagsSuggestions: false,
  }

  // ==========================================
  // 单部漫画与正文阅读器 (comic)
  // ==========================================
  comic = {
    // 关键：正文阅读器图片加载标头，缺少会导致 403 崩溃
    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: this.headers
      };
    },

    // 缩略图加载标头
    onThumbnailLoad: (url) => {
      return {
        url: url,
        headers: this.headers
      };
    },

    loadInfo: async (id) => {
      let fullUrl = id;
      if (!fullUrl.startsWith("http")) {
        fullUrl = `${this.baseUrl}${id.startsWith("/") ? id : "/" + id}`;
      }
      const res = await this.fetchWithCFCheck(fullUrl);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      try {
        const titleEl = document.querySelector(".text-xl");
        const title = titleEl ? titleEl.text.trim().split("   ")[0].trim() : "";

        const coverEl = document.querySelector(".object-cover") || document.querySelector(".pb-2 img");
        let cover = "";
        if (coverEl && coverEl.attributes) {
          cover = coverEl.attributes["data-src"] || coverEl.attributes["src"] || "";
        }
        cover = this.normalizeUrl(cover);

        const descEl = document.querySelector("p.text-medium");
        const description = descEl ? descEl.text.trim() : "";

        const infos = document.querySelectorAll("div.py-1");
        const tags = { "作者": [], "类型": [], "标签": [] };
        if (infos.length > 0) {
          for (let author of infos[0].querySelectorAll("a > span")) {
            let author_name = author.text ? author.text.trim() : "";
            if (author_name.endsWith(",")) {
              author_name = author_name.slice(0, -1).trim();
            }
            if (author_name) tags["作者"].push(author_name);
          }
        }
        if (infos.length > 1) {
          for (let category of infos[1].querySelectorAll("a > span")) {
            let category_name = category.text ? category.text.trim() : "";
            if (category_name.endsWith(",")) {
              category_name = category_name.slice(0, -1).trim();
            }
            if (category_name) tags["类型"].push(category_name);
          }
        }
        if (infos.length > 2) {
          for (let tag of infos[2].querySelectorAll("a")) {
            let tag_name = tag.text ? tag.text.replace("\n", "").replaceAll(" ", "").replace("#", "").trim() : "";
            if (tag_name) tags["标签"].push(tag_name);
          }
        }

        const mangachaptersEl = document.querySelector("#mangachapters");
        if (!mangachaptersEl || !mangachaptersEl.attributes || !mangachaptersEl.attributes["data-mid"]) {
          throw "无法解析漫画章节 ID (data-mid 缺失)";
        }
        const mangaId = mangachaptersEl.attributes["data-mid"];

        const chapterRes = await this.fetchWithCFCheck(`${this.baseUrl}/manga/get?mid=${mangaId}&mode=all&t=${Date.now()}`);
        if (chapterRes.status !== 200) {
          throw `章节列表加载失败: ${chapterRes.status}`;
        }
        const chapterDoc = new HtmlDocument(chapterRes.body);
        const chapters = {};
        try {
          for (let ch of chapterDoc.querySelectorAll(".chapteritem")) {
            const info = ch.querySelector("a");
            const titleSpan = ch.querySelector(".chaptertitle");
            if (info && info.attributes && info.attributes["data-ms"] && info.attributes["data-cs"]) {
              const epKey = `${info.attributes["data-ms"]}@${info.attributes["data-cs"]}`;
              const epTitle = titleSpan ? titleSpan.text.trim() : "章节";
              chapters[epKey] = epTitle;
            }
          }
        } finally {
          chapterDoc.dispose();
        }

        const recommend = [];
        for (let item of document.querySelectorAll("div.cardlist > div.pb-2")) {
          const a = item.querySelector("a");
          const h3 = item.querySelector("h3");
          const img = item.querySelector("img");
          if (a && h3 && a.attributes && a.attributes["href"]) {
            let recCover = "";
            if (img && img.attributes) {
              recCover = img.attributes["data-src"] || img.attributes["src"] || "";
            }
            recommend.push(new Comic({
              id: a.attributes["href"],
              title: h3.text ? h3.text.trim() : "",
              cover: this.normalizeUrl(recCover)
            }));
          }
        }

        return new ComicDetails({
          title: title,
          cover: cover,
          description: description,
          tags: tags,
          chapters: chapters,
          recommend: this.fitToRow(recommend, 28)
        });
      } finally {
        document.dispose();
      }
    },

    loadEp: async (comicId, epId) => {
      const ids = epId.split("@");
      if (ids.length < 2) {
        throw `无效的章节 ID 格式: ${epId}`;
      }
      const res = await this.fetchWithCFCheck(`${this.baseUrl}/chapter/getcontent?m=${ids[0]}&c=${ids[1]}`);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      try {
        const images = [];
        const chapContent = document.querySelector("#chapcontent");
        if (chapContent) {
          for (let i of chapContent.querySelectorAll("img")) {
            if (i && i.attributes) {
              const rawUrl = i.attributes["data-src"] || i.attributes["src"];
              if (rawUrl) {
                images.push(this.normalizeUrl(rawUrl));
              }
            }
          }
        }
        return { images };
      } finally {
        document.dispose();
      }
    },

    enableTagsTranslate: false,
  }
}

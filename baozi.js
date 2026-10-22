/** @type {import('./_venera_.js')} */

function fitToRow(list, max = 28) {
  if (!list || list.length === 0) return [];
  const count = Math.min(list.length, max);
  const rows = Math.floor(count / 4);
  return list.slice(0, Math.max(rows * 4, 4));
}

function isChallenge(status, body) {
  if (status === 403 || status === 503) {
    if (
      body &&
      (body.indexOf("challenge-platform") !== -1 ||
        body.indexOf("cf-browser-verification") !== -1 ||
        body.indexOf("Just a moment") !== -1 ||
        body.indexOf("__cf_chl_") !== -1 ||
        body.indexOf("challenge_required") !== -1 ||
        body.indexOf("__gatekeeper_challenge") !== -1)
    ) {
      return true;
    }
    return true;
  }
  return false;
}

class Baozi extends ComicSource {
  // 此漫画源的名称
  name = "包子漫画";

  // 唯一标识符
  key = "baozi";

  version = "1.1.8";

  minAppVersion = "1.4.0";

  // 更新链接 (必须使用携带源名称前缀的具体 Git Tag)
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@baozi-v1.1.8/baozi.js";

  settings = {
    language: {
      title: "简繁切换",
      type: "select",
      options: [
        { value: "cn", text: "简体" },
        { value: "tw", text: "繁體" },
      ],
      default: "cn",
    },
    domains: {
      title: "主域名",
      type: "select",
      options: [
        { value: "webmota.com", text: "webmota.com (推荐稳定)" },
        { value: "kukuc.co", text: "kukuc.co (备用)" },
        { value: "dinnerku.com", text: "dinnerku.com (备用)" },
        { value: "twmanga.com", text: "twmanga.com (备用)" },
        { value: "bzmgcn.com", text: "bzmgcn.com (需盾/网关验证)" },
        { value: "baozimhcn.com", text: "baozimhcn.com (需盾/网关验证)" },
      ],
      default: "webmota.com",
    },
    cdn_domains: {
      title: "图片资源站域名",
      type: "select",
      options: [
        { value: "", text: "默认 (跟随站点)" },
        { value: "s1.bzcdn.net", text: "s1.bzcdn.net (推荐)" },
        { value: "as-rsa1-usla.baozicdn.com", text: "as-rsa1-usla.baozicdn.com" },
        { value: "as.baozimh.com", text: "as.baozimh.com" },
        { value: "s1.baozicdn.com", text: "s1.baozicdn.com" },
      ],
      default: "",
    },
    image_quality: {
      title: "图片画质",
      type: "select",
      options: [
        {
          value: "",
          text: "原图 (推荐稳定，防404)",
        },
      ],
      default: "",
    },
  };

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Referer": `${this.baseUrl}/`,
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    };
  }

  // 动态生成完整域名
  get lang() {
    return this.loadSetting("language") || this.settings.language.default;
  }

  get baseUrl() {
    let domain = this.loadSetting("domains") || this.settings.domains.default;
    return `https://${this.lang}.${domain}`;
  }

  async fetchWithCheck(url, customHeaders = null) {
    const res = await Network.get(url, customHeaders || this.headers);
    if (isChallenge(res.status, res.body)) {
      throw "目标站点风控拦截 (Gatekeeper / Cloudflare)：请在漫画源设置中切换可用镜像域名（如 webmota.com）。";
    }
    return res;
  }

  /// 账号
  account = {
    login: async (account, pwd) => {
      let res = await Network.post(
        `${this.baseUrl}/api/bui/signin`,
        {
          ...this.headers,
          "content-type":
            "multipart/form-data; boundary=----WebKitFormBoundaryFUNUxpOwyUaDop8s",
        },
        '------WebKitFormBoundaryFUNUxpOwyUaDop8s\r\nContent-Disposition: form-data; name="username"\r\n\r\n' +
          account +
          '\r\n------WebKitFormBoundaryFUNUxpOwyUaDop8s\r\nContent-Disposition: form-data; name="password"\r\n\r\n' +
          pwd +
          "\r\n------WebKitFormBoundaryFUNUxpOwyUaDop8s--\r\n"
      );
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let json = JSON.parse(res.body);
      let token = json.data;
      Network.setCookies(this.baseUrl, [
        new Cookie({
          name: "TSID",
          value: token,
          domain: this.loadSetting("domains") || this.settings.domains.default,
        }),
      ]);
      return "ok";
    },

    loginWithWebview: {
      url: "https://cn.webmota.com/user/login",
      checkStatus: (url, title) => {
        return (
          url.includes("/user/my_bookshelf") ||
          url.includes("/user/profile") ||
          (Boolean(title) &&
            !title.includes("登录") &&
            !title.includes("Sign in") &&
            !title.includes("Just a moment") &&
            !title.includes("Cloudflare"))
        );
      },
    },

    logout: () => {
      Network.deleteCookies(
        this.loadSetting("domains") || this.settings.domains.default
      );
    },

    get registerWebsite() {
      return `${this.baseUrl}/user/signup`;
    },
  };

  /// 解析漫画列表
  parseComic(e) {
    let aNode = e.querySelector("a");
    if (!aNode) return null;
    let url = aNode.attributes["href"] || "";
    let id = url.split("/").pop();
    let title = e.querySelector("h3")?.text?.trim() || aNode.attributes["title"] || "";
    let cover =
      e.querySelector("amp-img, img")?.attributes?.["src"] || "";
    cover = cover.replace(/&amp;/g, "&").trim();
    let tags = e
      .querySelectorAll("div.tabs > span")
      .map((s) => s.text.trim())
      .filter(Boolean);
    let description = e.querySelector("small")?.text?.trim() || "";
    return new Comic({
      id: id,
      title: title,
      cover: cover,
      tags: tags,
      description: description,
    });
  }

  parseJsonComic(e) {
    return new Comic({
      id: e.comic_id,
      title: e.name,
      subTitle: e.author,
      cover: `https://static-tw.baozimh.com/cover/${e.topic_img}?w=285&h=375&q=100`,
      tags: e.type_names || [],
    });
  }

  /// 探索页面
  explore = [
    {
      title: "包子漫画",
      type: "singlePageWithMultiPart",
      load: async () => {
        const res = await this.fetchWithCheck(this.baseUrl);
        if (res.status !== 200) {
          throw "Invalid status code: " + res.status;
        }
        const document = new HtmlDocument(res.body);
        try {
          const parts = document.querySelectorAll("div.index-recommend-items");
          const result = {};
          for (let part of parts) {
            const title = part.querySelector("div.catalog-title")?.text?.trim() || "";
            const comics = part
              .querySelectorAll("div.comics-card")
              .map((e) => this.parseComic(e))
              .filter(Boolean);
            if (comics.length > 0 && title) {
              result[title] = fitToRow(comics, 28);
            }
          }
          return result;
        } finally {
          document.dispose();
        }
      },
    },
  ];

  /// 分类页面
  category = {
    title: "包子漫画",
    parts: [
      {
        name: "类型",
        type: "fixed",
        categories: [
          "全部",
          "恋爱",
          "纯爱",
          "古风",
          "异能",
          "悬疑",
          "剧情",
          "科幻",
          "奇幻",
          "玄幻",
          "穿越",
          "冒险",
          "推理",
          "武侠",
          "格斗",
          "战争",
          "热血",
          "搞笑",
          "大女主",
          "都市",
          "总裁",
          "后宫",
          "日常",
          "韩漫",
          "少年",
          "其它",
        ],
        itemType: "category",
        categoryParams: [
          "all",
          "lianai",
          "chunai",
          "gufeng",
          "yineng",
          "xuanyi",
          "juqing",
          "kehuan",
          "qihuan",
          "xuanhuan",
          "chuanyue",
          "mouxian",
          "tuili",
          "wuxia",
          "gedou",
          "zhanzheng",
          "rexie",
          "gaoxiao",
          "danuzhu",
          "dushi",
          "zongcai",
          "hougong",
          "richang",
          "hanman",
          "shaonian",
          "qita",
        ],
      },
    ],
    enableRankingPage: false,
  };

  /// 分类漫画页面
  categoryComics = {
    load: async (category, param, options, page) => {
      const region = options && options[0] ? options[0] : "all";
      const state = options && options[1] ? options[1] : "all";
      const url = `${this.baseUrl}/api/bzmhq/amp_comic_list?type=${param}&region=${region}&state=${state}&filter=%2a&page=${page}&limit=36&language=${this.lang}&__amp_source_origin=${this.baseUrl}`;
      const res = await this.fetchWithCheck(url);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let maxPage = null;
      let json = JSON.parse(res.body);
      if (!json.next) {
        maxPage = page;
      }
      return {
        comics: (json.items || []).map((e) => this.parseJsonComic(e)),
        maxPage: maxPage,
      };
    },
    optionList: [
      {
        options: ["all-全部", "cn-国漫", "jp-日本", "kr-韩国", "en-欧美"],
      },
      {
        options: ["all-全部", "serial-连载中", "pub-已完结"],
      },
    ],
  };

  /// 搜索
  search = {
    load: async (keyword, options, page) => {
      if (!keyword || !keyword.trim()) {
        return { comics: [], maxPage: 1 };
      }
      const q = encodeURIComponent(keyword.trim());
      const res = await this.fetchWithCheck(`${this.baseUrl}/search?q=${q}`);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      const document = new HtmlDocument(res.body);
      try {
        const comics = document
          .querySelectorAll("div.comics-card")
          .map((e) => this.parseComic(e))
          .filter(Boolean);
        return {
          comics: comics,
          maxPage: 1,
        };
      } finally {
        document.dispose();
      }
    },
    optionList: [],
  };

  /// 收藏
  favorites = {
    multiFolder: false,
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      const op = isAdding ? "set_bookmark" : "del_bookmark";
      const extra = isAdding ? "&chapter_slot=0" : "";
      const res = await Network.post(
        `${this.baseUrl}/user/operation_v2?op=${op}&comic_id=${comicId}${extra}`,
        this.headers
      );
      if (!res.status || res.status >= 400) {
        throw "Invalid status code: " + res.status;
      }
      return "ok";
    },
    loadFolders: null,
    loadComics: async (page, folder) => {
      const res = await Network.get(`${this.baseUrl}/user/my_bookshelf`, this.headers);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      const document = new HtmlDocument(res.body);
      try {
        const parseBook = (e) => {
          let title = e.querySelector("h4 > a")?.text?.trim() || "";
          let url = e.querySelector("h4 > a")?.attributes["href"] || "";
          let id = url.split("/").pop();
          let author =
            e.querySelector("div.info > ul")?.children?.[1]?.text?.split("：")?.[1]?.trim() || "";
          let description =
            e.querySelector("div.info > ul")?.children?.[4]?.children?.[0]?.text?.trim() || "";
          let cover = e.querySelector("amp-img, img")?.attributes?.["src"] || "";
          cover = cover.replace(/&amp;/g, "&").trim();

          return new Comic({
            id: id,
            title: title,
            subTitle: author,
            description: description,
            cover: cover,
          });
        };
        const comics = document
          .querySelectorAll("div.bookshelf-items")
          .map((e) => parseBook(e))
          .filter(Boolean);
        return {
          comics: comics,
          maxPage: 1,
        };
      } finally {
        document.dispose();
      }
    },
  };

  /// 单个漫画与正文阅读器
  comic = {
    // 关键：正文图片加载标头，缺少会导致阅读器 403
    onImageLoad: (url, comicId, epId) => {
      // 关键防御：彻底清理 /w640 路径片段（部分图片在 CDN 上无 640p 缩略图会导致 404）
      const cleanUrl = url
        ? url.replace(/\/w640\//g, "/").replace(/\/w640(?=\/|$)/g, "")
        : url;
      return {
        url: cleanUrl,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Referer": `${this.baseUrl}/`,
        },
      };
    },

    // 缩略图加载标头
    onThumbnailLoad: (url) => {
      const cleanUrl = url
        ? url.replace(/\/w640\//g, "/").replace(/\/w640(?=\/|$)/g, "")
        : url;
      return {
        url: cleanUrl,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Referer": `${this.baseUrl}/`,
        },
      };
    },

    // 加载漫画信息
    loadInfo: async (id) => {
      const res = await this.fetchWithCheck(`${this.baseUrl}/comic/${id}`);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      const document = new HtmlDocument(res.body);
      try {
        const title =
          document.querySelector("h1.comics-detail__title")?.text?.trim() || id;
        let cover =
          document.querySelector("div.l-content amp-img, .comics-detail amp-img")
            ?.attributes?.["src"] || "";
        cover = cover.replace(/&amp;/g, "&").trim();
        const author =
          document.querySelector("h2.comics-detail__author")?.text?.trim() || "";
        let tags = document
          .querySelectorAll("div.tag-list > span")
          .map((e) => e.text.trim())
          .filter(Boolean);

        let updateTime = document
          .querySelector("div.supporting-text > div > span > em")
          ?.text?.trim()
          ?.replace("(", "")
          ?.replace(")", "");

        if (!updateTime) {
          const containers = [
            ...document.querySelectorAll("#chapter-items, #chapters_other_list"),
          ];
          let allChapters = [];
          containers.forEach((container) => {
            const chapters = container.querySelectorAll(".comics-chapters a");
            allChapters.push(...Array.from(chapters));
          });
          const lastChapter = allChapters[allChapters.length - 1];
          updateTime =
            lastChapter?.querySelector("div span, span")?.text?.trim() ||
            "暂无更新信息";
        }

        const description =
          document.querySelector("p.comics-detail__desc")?.text?.trim() || "";

        const chapters = new Map();
        const aNodes = [
          ...document.querySelectorAll("#chapter-items .comics-chapters a"),
          ...document.querySelectorAll("#chapters_other_list .comics-chapters a"),
        ];

        let i = 0;
        for (let a of aNodes) {
          const href = a.attributes["href"] || "";
          const chTitle =
            a.querySelector("span")?.text?.trim() || a.text?.trim() || `第 ${i + 1} 话`;
          const m = href.match(/section_slot=(\d+)&(?:amp;)?chapter_slot=(\d+)/);
          let epId;
          if (m) {
            epId = `${m[1]}_${m[2]}`;
          } else {
            const chMatch = href.match(/chapter\/[^/]+\/([^/.]+)/);
            epId = chMatch ? chMatch[1] : `0_${i}`;
          }
          chapters.set(epId, chTitle);
          i++;
        }

        // 兜底：若前两者为空，使用最新章节列表（倒序反转）
        if (chapters.size === 0) {
          const fallbackNodes = Array.from(
            document.querySelectorAll(".comics-chapters a")
          ).reverse();
          for (let a of fallbackNodes) {
            const href = a.attributes["href"] || "";
            const chTitle =
              a.querySelector("span")?.text?.trim() || a.text?.trim() || `第 ${i + 1} 话`;
            const m = href.match(/section_slot=(\d+)&(?:amp;)?chapter_slot=(\d+)/);
            let epId;
            if (m) {
              epId = `${m[1]}_${m[2]}`;
            } else {
              const chMatch = href.match(/chapter\/[^/]+\/([^/.]+)/);
              epId = chMatch ? chMatch[1] : `0_${i}`;
            }
            chapters.set(epId, chTitle);
            i++;
          }
        }

        let recommend = [];
        for (let c of document.querySelectorAll("div.recommend--item")) {
          if (c.querySelectorAll("div.tag-comic").length > 0) {
            let rTitle = c.querySelector("span")?.text?.trim() || "";
            let rCover = c.querySelector("amp-img")?.attributes?.["src"] || "";
            rCover = rCover.replace(/&amp;/g, "&").trim();
            let rUrl = c.querySelector("a")?.attributes?.["href"] || "";
            let rId = rUrl.split("/").pop();
            recommend.push(
              new Comic({
                id: rId,
                title: rTitle,
                cover: rCover,
              })
            );
          }
        }

        let updateDate = (updateTime || "")
          .replace(/年/g, "-")
          .replace(/月/g, "-")
          .replace(/日/g, "");

        return new ComicDetails({
          title: title,
          cover: cover,
          description: description,
          tags: {
            作者: [author],
            标签: tags,
          },
          chapters: chapters,
          recommend: recommend,
          updateTime: updateDate,
        });
      } finally {
        document.dispose();
      }
    },

    loadEp: async (comicId, epId) => {
      const images = [];
      const chapterSlot = epId.includes("_") ? epId : `0_${epId}`;
      const currentPageUrl = `${this.baseUrl}/comic/chapter/${comicId}/${chapterSlot}.html`;

      const res = await this.fetchWithCheck(currentPageUrl);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }

      const doc = new HtmlDocument(res.body);
      try {
        const imageNodes = doc.querySelectorAll(
          ".comic-contain amp-img, .comic-contain .chapter-img, .comic-contain [data-src]"
        );
        for (let imgNode of imageNodes) {
          let imgUrl =
            imgNode.attributes?.["data-src"] || imgNode.attributes?.["src"];
          if (
            imgUrl &&
            !imgUrl.includes("default_cover") &&
            !imgUrl.includes("placeholder")
          ) {
            imgUrl = imgUrl.replace(/&amp;/g, "&").trim();
            const match = imgUrl.match(
              /^(https?:\/\/)?([^/\s:]+)(:\d+)?(\/[a-z]comic\/.*)/
            );
            if (match) {
              const domainSetting = this.loadSetting("cdn_domains");
              const domain = domainSetting || match[2];
              imgUrl = `${match[1]}${domain}${match[4]}`;
              // 彻底剥离 /w640 缩略图路径，统一使用 100% 可用的原图
              imgUrl = imgUrl.replace(/\/w640\//g, "/").replace(/\/w640(?=\/|$)/g, "");
            }
            if (!images.includes(imgUrl)) {
              images.push(imgUrl);
            }
          }
        }
      } finally {
        doc.dispose();
      }
      return { images: images };
    },
  };
}

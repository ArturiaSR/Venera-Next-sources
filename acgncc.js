/** @type {import('./_venera_.js')} */
class Acgncc extends ComicSource {
  name = "ACGN漫画";
  key = "acgncc";
  version = "1.0.2";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@acgncc-v1.0.2/acgncc.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://comic.acgn.cc", text: "https://comic.acgn.cc (主站)" }
      ],
      default: "https://comic.acgn.cc"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://comic.acgn.cc";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
      "http_client": "dart:io"
    };
  }

  fitToRow(list, max = 24) {
    let len = Math.min(list.length, max);
    len = len - (len % 4);
    return list.slice(0, len);
  }

  fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.baseUrl.replace(/\/$/, "") + "/" + u.replace(/^\//, "");
  }

  extractId(href) {
    if (!href) return "";
    let m = href.match(/manhua-([^\.]+)\.htm/i);
    return m ? m[1] : href.replace(/^\/?manhua-/, "").replace(/\.htm$/, "").replace(/^\//, "");
  }

  parseListItem(item) {
    let link = item.querySelector(".list_r h2 a, h2 a, dt a");
    if (!link) return null;
    let href = link.attributes.href || "";
    let id = this.extractId(href);
    let title = link.text?.trim() || "";
    if (!id || !title) return null;

    let img = item.querySelector(".list_l img, img");
    let cover = img?.attributes?.src || img?.attributes?.["data-src"] || "";
    let last = item.querySelector(".list_l .last, .last")?.text?.trim() || "";
    let desc = item.querySelector(".list_r p, p")?.text?.trim() || "";

    return new Comic({
      id,
      title,
      subTitle: last,
      cover: this.fixUrl(cover),
      tags: [],
      description: desc
    });
  }

  explore = [{
    title: "ACGN漫画",
    type: "multiPartPage",
    load: async (page) => {
      let res = await Network.get(this.baseUrl + "/", this.headers);
      if (res.status !== 200) throw `加载首页失败: HTTP ${res.status}`;
      let doc = new HtmlDocument(res.body);
      try {
        const parts = [];

        // 1. 最新更新 (tabs-panel 0)
        let panels = doc.querySelectorAll(".tabs-panel");
        if (panels.length > 0) {
          let p0Items = panels[0].querySelectorAll("li");
          let latestList = [];
          for (let li of p0Items) {
            let a = li.querySelector("div a, a");
            let img = li.querySelector("img");
            let span = li.querySelector("span");
            if (a) {
              let id = this.extractId(a.attributes.href || "");
              let title = a.attributes.title || a.text?.trim() || "";
              let cover = img?.attributes?.src || "";
              let subTitle = span?.text?.trim() || "";
              if (id && title) {
                latestList.push(new Comic({
                  id,
                  title,
                  subTitle,
                  cover: this.fixUrl(cover),
                  tags: [],
                  description: ""
                }));
              }
            }
          }
          if (latestList.length > 0) {
            parts.push({
              title: "最新更新",
              comics: this.fitToRow(latestList, 12),
              viewMore: null
            });
          }
        }

        // 2. 近期连载 (tabs-panel 1 & 2)
        if (panels.length > 1) {
          let recentList = [];
          for (let i = 1; i < panels.length; i++) {
            let lis = panels[i].querySelectorAll("li");
            for (let li of lis) {
              let a = li.querySelector("div a, a");
              let img = li.querySelector("img");
              let span = li.querySelector("span");
              if (a) {
                let id = this.extractId(a.attributes.href || "");
                let title = a.attributes.title || a.text?.trim() || "";
                let cover = img?.attributes?.src || "";
                let subTitle = span?.text?.trim() || "";
                if (id && title) {
                  recentList.push(new Comic({
                    id,
                    title,
                    subTitle,
                    cover: this.fixUrl(cover),
                    tags: [],
                    description: ""
                  }));
                }
              }
            }
          }
          if (recentList.length > 0) {
            parts.push({
              title: "近期连载",
              comics: this.fitToRow(recentList, 24),
              viewMore: null
            });
          }
        }

        // 3. 分类推荐 (32个分类专栏展位特色漫画)
        let featuredNodes = doc.querySelectorAll(".cate_cont_l a");
        let featuredList = [];
        for (let a of featuredNodes) {
          let id = this.extractId(a.attributes.href || "");
          let title = a.attributes.title || a.querySelector("span")?.text?.trim() || "";
          let img = a.querySelector("img");
          let cover = img?.attributes?.src || "";
          if (id && title) {
            featuredList.push(new Comic({
              id,
              title,
              subTitle: "",
              cover: this.fixUrl(cover),
              tags: [],
              description: ""
            }));
          }
        }
        if (featuredList.length > 0) {
          parts.push({
            title: "分类精选",
            comics: this.fitToRow(featuredList, 32),
            viewMore: null
          });
        }

        return parts;
      } finally {
        doc.dispose();
      }
    }
  }];

  category = {
    title: "ACGN漫画",
    parts: [
      {
        name: "题材分类",
        type: "fixed",
        categories: [
          { label: "耽美", target: { page: "category", attributes: { category: "题材", param: "18" } } },
          { label: "热血", target: { page: "category", attributes: { category: "题材", param: "19" } } },
          { label: "后宫", target: { page: "category", attributes: { category: "题材", param: "20" } } },
          { label: "历史", target: { page: "category", attributes: { category: "题材", param: "21" } } },
          { label: "战争", target: { page: "category", attributes: { category: "题材", param: "22" } } },
          { label: "萌系", target: { page: "category", attributes: { category: "题材", param: "23" } } },
          { label: "宅男腐女", target: { page: "category", attributes: { category: "题材", param: "24" } } },
          { label: "治愈", target: { page: "category", attributes: { category: "题材", param: "25" } } },
          { label: "励志", target: { page: "category", attributes: { category: "题材", param: "26" } } },
          { label: "武侠", target: { page: "category", attributes: { category: "题材", param: "27" } } },
          { label: "机战", target: { page: "category", attributes: { category: "题材", param: "28" } } },
          { label: "音乐舞蹈", target: { page: "category", attributes: { category: "题材", param: "29" } } },
          { label: "美食", target: { page: "category", attributes: { category: "题材", param: "30" } } },
          { label: "职场", target: { page: "category", attributes: { category: "题材", param: "31" } } },
          { label: "西方魔幻", target: { page: "category", attributes: { category: "题材", param: "32" } } },
          { label: "高清单行本", target: { page: "category", attributes: { category: "题材", param: "33" } } },
          { label: "冒险", target: { page: "category", attributes: { category: "题材", param: "1" } } },
          { label: "搞笑", target: { page: "category", attributes: { category: "题材", param: "2" } } },
          { label: "格斗", target: { page: "category", attributes: { category: "题材", param: "3" } } },
          { label: "科幻", target: { page: "category", attributes: { category: "题材", param: "4" } } },
          { label: "爱情", target: { page: "category", attributes: { category: "题材", param: "5" } } },
          { label: "侦探", target: { page: "category", attributes: { category: "题材", param: "6" } } },
          { label: "竞技", target: { page: "category", attributes: { category: "题材", param: "7" } } },
          { label: "魔法", target: { page: "category", attributes: { category: "题材", param: "8" } } },
          { label: "东方神鬼", target: { page: "category", attributes: { category: "题材", param: "9" } } },
          { label: "校园", target: { page: "category", attributes: { category: "题材", param: "10" } } },
          { label: "恐怖", target: { page: "category", attributes: { category: "题材", param: "11" } } },
          { label: "其他", target: { page: "category", attributes: { category: "题材", param: "12" } } },
          { label: "四格", target: { page: "category", attributes: { category: "题材", param: "13" } } },
          { label: "生活亲情", target: { page: "category", attributes: { category: "题材", param: "14" } } },
          { label: "百合", target: { page: "category", attributes: { category: "题材", param: "15" } } },
          { label: "伪娘", target: { page: "category", attributes: { category: "题材", param: "16" } } },
          { label: "悬疑", target: { page: "category", attributes: { category: "题材", param: "17" } } }
        ]
      },
      {
        name: "字母索引",
        type: "fixed",
        categories: [
          { label: "A", target: { page: "category", attributes: { category: "字母", param: "a" } } },
          { label: "B", target: { page: "category", attributes: { category: "字母", param: "b" } } },
          { label: "C", target: { page: "category", attributes: { category: "字母", param: "c" } } },
          { label: "D", target: { page: "category", attributes: { category: "字母", param: "d" } } },
          { label: "E", target: { page: "category", attributes: { category: "字母", param: "e" } } },
          { label: "F", target: { page: "category", attributes: { category: "字母", param: "f" } } },
          { label: "G", target: { page: "category", attributes: { category: "字母", param: "g" } } },
          { label: "H", target: { page: "category", attributes: { category: "字母", param: "h" } } },
          { label: "I", target: { page: "category", attributes: { category: "字母", param: "i" } } },
          { label: "J", target: { page: "category", attributes: { category: "字母", param: "j" } } },
          { label: "K", target: { page: "category", attributes: { category: "字母", param: "k" } } },
          { label: "L", target: { page: "category", attributes: { category: "字母", param: "l" } } },
          { label: "M", target: { page: "category", attributes: { category: "字母", param: "m" } } },
          { label: "N", target: { page: "category", attributes: { category: "字母", param: "n" } } },
          { label: "O", target: { page: "category", attributes: { category: "字母", param: "o" } } },
          { label: "P", target: { page: "category", attributes: { category: "字母", param: "p" } } },
          { label: "Q", target: { page: "category", attributes: { category: "字母", param: "q" } } },
          { label: "R", target: { page: "category", attributes: { category: "字母", param: "r" } } },
          { label: "S", target: { page: "category", attributes: { category: "字母", param: "s" } } },
          { label: "T", target: { page: "category", attributes: { category: "字母", param: "t" } } },
          { label: "U", target: { page: "category", attributes: { category: "字母", param: "u" } } },
          { label: "V", target: { page: "category", attributes: { category: "字母", param: "v" } } },
          { label: "W", target: { page: "category", attributes: { category: "字母", param: "w" } } },
          { label: "X", target: { page: "category", attributes: { category: "字母", param: "x" } } },
          { label: "Y", target: { page: "category", attributes: { category: "字母", param: "y" } } },
          { label: "Z", target: { page: "category", attributes: { category: "字母", param: "z" } } },
          { label: "0-9", target: { page: "category", attributes: { category: "字母", param: "0-9" } } }
        ]
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let isLetter = /^[a-z]|0-9$/i.test(param);
      let p = parseInt(page) || 1;
      let url = isLetter
        ? (p === 1 ? `${this.baseUrl}/pinyin-${param}.htm` : `${this.baseUrl}/pinyin-${param}.htm?page=${p}`)
        : (p === 1 ? `${this.baseUrl}/cate-${param}.htm` : `${this.baseUrl}/cate-${param}.htm?page=${p}`);

      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `分类加载失败: HTTP ${res.status}`;
      let doc = new HtmlDocument(res.body);
      try {
        let items = doc.querySelectorAll("#display li, .display.list2 li, .container ul li");
        let comics = [];
        for (let item of items) {
          let c = this.parseListItem(item);
          if (c) comics.push(c);
        }

        let maxPage = p;
        let lastA = doc.querySelector("#pagination a[rel='last']");
        if (lastA) {
          let val = parseInt(lastA.attributes["_val"] || lastA.text?.trim() || "");
          if (!isNaN(val) && val > 0) maxPage = val;
        } else {
          let pLinks = doc.querySelectorAll("#pagination a, #pagination strong");
          for (let pl of pLinks) {
            let n = parseInt(pl.attributes["_val"] || pl.text?.trim() || "");
            if (!isNaN(n) && n > maxPage) maxPage = n;
          }
        }

        return {
          comics,
          maxPage: !isNaN(maxPage) && maxPage > 0 ? maxPage : 1
        };
      } finally {
        doc.dispose();
      }
    }
  };

  search = {
    load: async (keyword, options, page) => {
      try {
        let kw = (keyword || "").trim();
        if (!kw) return { comics: [], maxPage: 1 };
        let p = parseInt(page) || 1;

        // 1. 优先尝试直接匹配漫画ID / 拼音别名 (如 huoyingrenzhe)
        let cleanId = kw.replace(/^\/?manhua-/, "").replace(/\.htm$/, "");
        if (/^[a-z0-9_-]+$/i.test(cleanId) && cleanId.length > 2) {
          let directRes = await Network.get(`${this.baseUrl}/manhua-${cleanId}.htm`, this.headers);
          if (directRes.status === 200) {
            let doc = new HtmlDocument(directRes.body);
            try {
              let title = doc.querySelector(".list_navbox h3 a, #breadcrumb h1, h1")?.text?.trim() || cleanId;
              let coverImg = doc.querySelector(".box_info img[src*='/logo/'], .box_info2 img[src*='/logo/'], .box_info img");
              let cover = coverImg?.attributes?.src || "";
              let author = "";
              let metaLis = doc.querySelectorAll(".load01_r li.mss");
              for (let li of metaLis) {
                let txt = li.text?.trim() || "";
                if (txt.includes("漫畫作者")) {
                  author = li.querySelector("span")?.text?.trim() || "";
                  break;
                }
              }
              return {
                comics: [
                  new Comic({
                    id: cleanId,
                    title,
                    subTitle: author,
                    cover: this.fixUrl(cover),
                    tags: [],
                    description: ""
                  })
                ],
                maxPage: 1
              };
            } finally {
              doc.dispose();
            }
          }
        }

        // 2. 检查是否匹配分类关键字
        const categoryMap = {
          "耽美": "18", "热血": "19", "後宮": "20", "后宫": "20", "歷史": "21", "历史": "21",
          "戰爭": "22", "战争": "22", "萌系": "23", "宅男腐女": "24", "治癒": "25", "治愈": "25",
          "勵志": "26", "励志": "26", "武俠": "27", "武侠": "27", "機戰": "28", "机战": "28",
          "音樂舞蹈": "29", "音乐舞蹈": "29", "美食": "30", "職場": "31", "职场": "31",
          "西方魔幻": "32", "高清单行本": "33", "高清單行本": "33", "冒險": "1", "冒险": "1",
          "搞笑": "2", "格鬥": "3", "格斗": "3", "科幻": "4", "愛情": "5", "爱情": "5",
          "偵探": "6", "侦探": "6", "競技": "7", "竞技": "7", "魔法": "8", "東方神鬼": "9",
          "东方神鬼": "9", "校園": "10", "校园": "10", "恐怖": "11", "其他": "12", "四格": "13",
          "生活親情": "14", "生活亲情": "14", "百合": "15", "偽娘": "16", "伪娘": "16", "懸疑": "17", "悬疑": "17"
        };
        for (let [cName, cId] of Object.entries(categoryMap)) {
          if (kw === cName || kw.includes(cName)) {
            return await this.categoryComics.load("题材", cId, options, p);
          }
        }

        // 3. 检查是否匹配拼音字母单字母索引
        if (/^[a-z]$/i.test(kw) || kw === "0-9") {
          return await this.categoryComics.load("字母", kw.toLowerCase(), options, p);
        }

        // 4. 原站作者检索路由
        let authorUrl = `${this.baseUrl}/author/${encodeURIComponent(kw)}${p > 1 ? '?page=' + p : ''}`;
        let res = await Network.get(authorUrl, this.headers);
        if (res.status === 200) {
          let doc = new HtmlDocument(res.body);
          try {
            let items = doc.querySelectorAll("#display li, .display.list2 li, .container ul li");
            let comics = [];
            for (let item of items) {
              let c = this.parseListItem(item);
              if (c) comics.push(c);
            }
            if (comics.length > 0) {
              let maxPage = p;
              let lastA = doc.querySelector("#pagination a[rel='last']");
              if (lastA) {
                let val = parseInt(lastA.attributes["_val"] || lastA.text?.trim() || "");
                if (!isNaN(val) && val > 0) maxPage = val;
              }
              return {
                comics,
                maxPage: !isNaN(maxPage) && maxPage > 0 ? maxPage : 1
              };
            }
          } finally {
            doc.dispose();
          }
        }

        return { comics: [], maxPage: 1 };
      } catch (e) {
        return { comics: [], maxPage: 1 };
      }
    }
  };

  comic = {
    loadInfo: async (id) => {
      let cleanId = id.replace(/^\/?manhua-/, "").replace(/\.htm$/, "");
      let url = `${this.baseUrl}/manhua-${cleanId}.htm`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `详情加载失败: HTTP ${res.status}`;
      let doc = new HtmlDocument(res.body);
      try {
        let title = doc.querySelector(".list_navbox h3 a, #breadcrumb h1, h1")?.text?.trim() || cleanId;
        let coverImg = doc.querySelector(".box_info img[src*='/logo/'], .box_info2 img[src*='/logo/'], .box_info img");
        let cover = coverImg?.attributes?.src || "";

        let author = "";
        let status = "";
        let updateTime = "";
        let cateTags = [];

        let metaLis = doc.querySelectorAll(".load01_r li.mss");
        for (let li of metaLis) {
          let txt = li.text?.trim() || "";
          if (txt.includes("漫畫作者")) {
            author = li.querySelector("span")?.text?.trim() || "";
          } else if (txt.includes("漫畫狀態")) {
            status = li.querySelector("span")?.text?.trim() || "";
          } else if (txt.includes("最新收錄")) {
            updateTime = li.querySelector("span")?.text?.trim() || "";
          } else if (txt.includes("漫畫分類")) {
            let catLinks = li.querySelectorAll("a");
            for (let ca of catLinks) {
              let ctxt = ca.text?.trim();
              if (ctxt) cateTags.push(ctxt);
            }
          }
        }

        let descEl = doc.querySelector(".box_info2 dd");
        let description = descEl?.text?.trim() || "";

        let chapters = new Map();
        let chapterLinks = doc.querySelectorAll("#content a[href*='view-'], .tabs-panel a[href*='view-'], ul a[href*='view-']");
        let chapList = [];
        let visited = new Set();
        for (let link of chapterLinks) {
          let href = link.attributes.href || "";
          let m = href.match(/view-(\d+)\.htm/i);
          if (m) {
            let epId = m[1];
            let ctitle = link.text?.trim() || `第 ${epId} 话`;
            if (!visited.has(epId)) {
              visited.add(epId);
              chapList.push({ epId, ctitle });
            }
          }
        }

        // 原站列表通常为倒序展示（最新在首），翻转为正序（第01话在前）以符合阅读器习惯
        chapList.reverse();
        for (let chap of chapList) {
          chapters.set(chap.epId, chap.ctitle);
        }

        let tags = {};
        if (author) tags["作者"] = [author];
        if (status) tags["状态"] = [status];
        if (cateTags.length > 0) tags["分类"] = cateTags;

        return new ComicDetails({
          title,
          cover: this.fixUrl(cover),
          description,
          tags,
          chapters,
          updateTime
        });
      } finally {
        doc.dispose();
      }
    },

    loadEp: async (comicId, epId) => {
      let url = `${this.baseUrl}/view-${epId}.htm`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `章节加载失败: HTTP ${res.status}`;

      let images = [];
      let doc = new HtmlDocument(res.body);
      try {
        let nodes = doc.querySelectorAll("#pic_list .pic, #pic_list [_src], #pic_list img");
        for (let node of nodes) {
          let src = node.attributes["_src"] || node.attributes["data-src"] || node.attributes["src"] || "";
          if (src && !src.includes("loading.gif") && !src.includes("no_img.gif") && !images.includes(src)) {
            images.push(this.fixUrl(src));
          }
        }
      } finally {
        doc.dispose();
      }

      // DOM 解析兜底
      if (images.length === 0) {
        let matches = res.body.matchAll(/_src="([^"]+)"/g);
        for (let m of matches) {
          if (m[1] && !images.includes(m[1])) {
            images.push(this.fixUrl(m[1]));
          }
        }
      }

      return { images };
    },

    onImageLoad: (url, comicId, epId) => ({
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": this.baseUrl + "/"
      }
    }),

    onThumbnailLoad: (url) => ({
      url,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": this.baseUrl + "/"
      }
    })
  };
}

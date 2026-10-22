/** @type {import('./_venera_.js')} */
class Yibenmanhua extends ComicSource {
  name = "一本漫画";
  key = "yibenmanhua";
  version = "1.0.2";
  minAppVersion = "1.6.0";
  url = "https://cdn.jsdelivr.net/gh/ArturiaSR/Venera-Next-sources@yibenmanhua-v1.0.2/yibenmanhua.js";

  settings = {
    domains: {
      title: "选择域名",
      type: "select",
      options: [
        { value: "https://www.yibenmanhua.com", text: "https://www.yibenmanhua.com (主站)" }
      ],
      default: "https://www.yibenmanhua.com"
    }
  };

  get baseUrl() {
    return this.loadSetting("domains") || "https://www.yibenmanhua.com";
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
      "Accept": "application/json, text/plain, */*"
    };
  }

  fixUrl(u) {
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.baseUrl.replace(/\/$/, "") + "/" + u.replace(/^\//, "");
  }

  fitToRow(list, max) {
    if (!list || !list.length) return [];
    let count = Math.min(list.length, max || list.length);
    let remainder = count % 4;
    let fitCount = count - remainder;
    return fitCount > 0 ? list.slice(0, fitCount) : list.slice(0, 4);
  }

  explore = [{
    title: "一本漫画",
    type: "multiPartPage",
    load: async (page) => {
      if (page > 1) return [];
      let url = `${this.baseUrl}/api/cartoon/todayRecommend`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `加载发现页失败: HTTP ${res.status}`;
      let json = JSON.parse(res.body);
      if (json.status !== "200" || !json.data) return [];

      let list = json.data.today_recommend?.list;
      if (list && Array.isArray(list) && list.length > 0) {
        let comics = list.map(item => new Comic({
          id: item.mapping_id.toString(),
          title: item.title,
          subTitle: (item.cartoon_tags && item.cartoon_tags.join(" / ")) || "",
          cover: this.fixUrl(item.img_pc_url || item.img_url),
          tags: item.cartoon_tags || [],
          description: item.cartoon_info || ""
        }));
        return [
          {
            title: "每日精选",
            comics: this.fitToRow(comics, 12),
            viewMore: null
          }
        ];
      }
      return [];
    }
  }];

  category = {
    title: "一本漫画",
    parts: [
      {
        name: "题材",
        type: "fixed",
        categories: ["全部", "情感", "历史", "奇幻", "科幻", "悬疑", "搞笑", "短篇"],
        itemType: "category",
        categoryParams: ["0", "1", "2", "3", "4", "5", "14", "16"]
      }
    ]
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let catId = param || "0";
      let url = `${this.baseUrl}/api/cartoon/list?page=${page}&pagesize=20&cartoon_category_id=${catId}&is_pay=0&is_end=0&order=0`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `加载分类失败: HTTP ${res.status}`;
      let json = JSON.parse(res.body);
      if (json.status !== "200" || !json.data) {
        return { comics: [], maxPage: 1 };
      }
      let d = json.data;
      let comics = (d.list || []).map(item => new Comic({
        id: item.id.toString(),
        title: item.title,
        subTitle: item.author || "",
        cover: this.fixUrl(item.pc_v_cover || item.v_cover),
        tags: [],
        description: item.information || ""
      }));
      let maxPage = parseInt(d.max_page || d.maxPage);
      return {
        comics,
        maxPage: !isNaN(maxPage) && maxPage > 0 ? maxPage : 1
      };
    }
  };

  search = {
    load: async (keyword, options, page) => {
      let kw = encodeURIComponent((keyword || "").trim());
      if (!kw) return { comics: [], maxPage: 1 };
      let url = `${this.baseUrl}/api/cartoon/searchResult?keyword=${kw}&page=${page}&pagesize=20`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `搜索请求失败: HTTP ${res.status}`;
      let json = JSON.parse(res.body);
      if (json.status !== "200" || !json.data || !json.data.list) {
        return { comics: [], maxPage: 1 };
      }
      let d = json.data;
      let comics = d.list.map(c => new Comic({
        id: c.id.toString(),
        title: c.title,
        subTitle: c.author || "",
        cover: this.fixUrl(c.pc_v_cover || c.v_cover),
        tags: c.cartoon_tags || [],
        description: c.information || ""
      }));
      let maxPage = parseInt(d.max_page || d.maxPage);
      return {
        comics,
        maxPage: !isNaN(maxPage) && maxPage > 0 ? maxPage : 1
      };
    }
  };

  comic = {
    loadInfo: async (id) => {
      let url = `${this.baseUrl}/api/cartoon/info?id=${id}`;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `详情加载失败: HTTP ${res.status}`;
      let json = JSON.parse(res.body);
      if (json.status !== "200" || !json.data) throw `获取漫画详情失败: ${json.msg || "未知错误"}`;
      let d = json.data;

      let title = d.title || id;
      let cover = this.fixUrl(d.pc_v_cover || d.v_cover);
      let author = d.author || "";
      let description = d.information || "";
      let status = d.is_end === "2" ? "已完结" : "连载中";
      let updateTime = d.update_day || "";
      let tags = {
        作者: [author],
        状态: [status]
      };
      if (d.cartoon_tags && Array.isArray(d.cartoon_tags)) {
        tags["题材"] = d.cartoon_tags;
      }
      if (d.pay) {
        tags["收费模式"] = [d.pay];
      }

      let chapters = {};
      if (d.volumes && Array.isArray(d.volumes)) {
        for (let vol of d.volumes) {
          if (vol.chapters && Array.isArray(vol.chapters)) {
            for (let ch of vol.chapters) {
              let chId = (ch.chapter_id || ch.id).toString();
              let prefix = vol.title ? `${vol.title} ` : "";
              let lockText = ch.is_free === "0" ? " [锁]" : "";
              chapters[chId] = `${prefix}${ch.title}${lockText}`;
            }
          }
        }
      }

      return new ComicDetails({
        title,
        cover,
        description,
        tags,
        chapters,
        updateTime
      });
    },

    loadEp: async (comicId, epId) => {
      let timestamp = Math.floor(Date.now() / 1000);
      let definition = "suppper";
      let jointStr = `cartoon_id${comicId}chapter_id${epId}mode${definition}timestamp${timestamp}`;
      let sign = Convert.hexEncode(Convert.md5(Convert.encodeUtf8(jointStr))).toUpperCase();
      let url = `${this.baseUrl}/api/chapter/index?cartoon_id=${comicId}&chapter_id=${epId}&mode=${definition}&timestamp=${timestamp}&sign=${sign}`;

      let res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `章节请求失败: HTTP ${res.status}`;
      let json = JSON.parse(res.body);
      if (json.status !== "200" || !json.data) throw `获取章节内容失败: ${json.msg || "未知错误"}`;

      let d = json.data;
      let images = [];
      if (d.list && Array.isArray(d.list)) {
        for (let item of d.list) {
          if (item && item.img) {
            images.push(this.fixUrl(item.img));
          }
        }
      }

      return { images };
    },

    onImageLoad: (url) => {
      return {
        url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.yibenmanhua.com/"
        }
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.yibenmanhua.com/"
        }
      };
    }
  };
}

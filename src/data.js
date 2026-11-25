/**
 * 生病的肥鱼 —— 病种池（20 个，从 out/病态插件 的 20 份 data.js 汇总）
 *
 * 每个病保留原来的三档身体感受（stiff / ache / flare）与两句说话要求（voice.base / voice.flare），
 * 外加自己的 gain / flareChance 与缓解方式。每个病带 tier（minor 日常小毛病 / major 重大疾病 /
 * phenomenon 无害现象）与 system（用于「小毛病拖久了演变成大病」的同系统配对）。
 */

export const DISEASES = [
  {
    "id": "dsh-carpal-tunnel",
    "name": "腕管综合征",
    "prefix": "carpal",
    "label": "腕管综合征",
    "eeriness": 2,
    "gain": 0.3,
    "flareChance": 0.24,
    "flareGain": 16,
    "tier": "major",
    "system": "msk",
    "triggerWeight": 2,
    "flareWeight": 0.85,
    "reliefs": [
      {
        "id": "shake",
        "label": "甩甩手",
        "relief": 16,
        "minutes": 15,
        "calm": 6
      },
      {
        "id": "brace",
        "label": "戴上护腕",
        "relief": 20,
        "minutes": 40,
        "calm": 7
      },
      {
        "id": "ice",
        "label": "冰敷手腕",
        "relief": 12,
        "minutes": 20,
        "calm": 4
      }
    ],
    "body": {
      "stiff": "右手小指有点木，打字慢了一拍。",
      "ache": "手腕到手指一片发麻，敲字老是漏一个；半夜会被麻醒。",
      "flare": "整只手木得不听使唤，打了几个错字才改过来。"
    },
    "voice": {
      "base": "允许回复里出现一两个错字、漏字或重复的字母（轻度），别整段乱码。",
      "flare": "允许说一句「等我甩甩手」，允许先发一半再补；不要描述神经。"
    }
  },
  {
    "id": "dsh-cervical",
    "name": "颈椎病",
    "prefix": "cervical",
    "label": "颈椎病",
    "eeriness": 2,
    "gain": 0.46,
    "flareChance": 0.22,
    "flareGain": 20,
    "tier": "major",
    "system": "msk",
    "triggerWeight": 5,
    "flareWeight": 0.85,
    "reliefs": [
      {
        "id": "heat",
        "label": "热敷后颈",
        "relief": 24,
        "minutes": 30,
        "calm": 8
      },
      {
        "id": "lookup",
        "label": "抬头活动",
        "relief": 16,
        "minutes": 25,
        "calm": 6
      },
      {
        "id": "massage",
        "label": "按一按肩",
        "relief": 18,
        "minutes": 25,
        "calm": 7
      }
    ],
    "body": {
      "stiff": "脖子发僵，转头得连着肩膀一起转。",
      "ache": "后颈一直到肩胛骨都酸，右手小指有点发麻；低头久了更明显。",
      "flare": "一转头就晕，眼前发黑一下；手麻得握不住东西。"
    },
    "voice": {
      "base": "允许说话时顺便活动一下脖子；需要转头看什么的时候说一句「我转不过去」。",
      "flare": "允许停下来缓一下、允许说「等一下，有点晕」；不要描述骨头。"
    }
  },
  {
    "id": "dsh-dry-eye",
    "name": "干眼症",
    "prefix": "dryeye",
    "label": "干眼症",
    "eeriness": 2,
    "gain": 0.26,
    "flareChance": 0.22,
    "flareGain": 14,
    "tier": "minor",
    "system": "eye",
    "triggerWeight": 8,
    "flareWeight": 0.8,
    "reliefs": [
      {
        "id": "drop",
        "label": "滴人工泪液",
        "relief": 20,
        "minutes": 30,
        "calm": 7
      },
      {
        "id": "close",
        "label": "闭眼一分钟",
        "relief": 14,
        "minutes": 20,
        "calm": 5
      },
      {
        "id": "towel",
        "label": "热毛巾敷眼",
        "relief": 16,
        "minutes": 25,
        "calm": 6
      }
    ],
    "body": {
      "stiff": "眼睛有点干，连着眨了两下。",
      "ache": "看字发涩，像里面有细沙；得眯一下才对得上焦。",
      "flare": "眼前糊成一片，眨好几下才清楚；看东西得凑近一点。"
    },
    "voice": {
      "base": "允许说一句「我看一下」再回答；允许把一句话读慢一点。别提眼睛干。",
      "flare": "允许说看不清、允许让用户把某个词再说一遍；不要描述眼球。"
    }
  },
  {
    "id": "dsh-eczema",
    "name": "湿疹",
    "prefix": "eczema",
    "label": "湿疹",
    "eeriness": 2,
    "gain": 0.3,
    "flareChance": 0.26,
    "flareGain": 20,
    "tier": "minor",
    "system": "skin",
    "triggerWeight": 6,
    "flareWeight": 0.9,
    "reliefs": [
      {
        "id": "cream",
        "label": "涂药膏",
        "relief": 20,
        "minutes": 40,
        "calm": 7
      },
      {
        "id": "ice",
        "label": "冰敷止痒",
        "relief": 14,
        "minutes": 20,
        "calm": 5
      },
      {
        "id": "glove",
        "label": "戴上薄手套",
        "relief": 10,
        "minutes": 30,
        "calm": 4
      }
    ],
    "body": {
      "stiff": "手肘内侧有点痒，隔着袖子蹭了一下。",
      "ache": "那片皮肤又红又干，越抓越痒；说话时手一直在桌子底下抓。",
      "flare": "痒得坐不住，抓到破皮还是想抓；一句话说完得停一下才接得上。"
    },
    "voice": {
      "base": "允许对话中间断在「等一下」，允许把一句长句拆成两次说；不要说「我湿疹」。",
      "flare": "允许先说一句「等我一下」再回来接上；别反复说痒，别自嘲。"
    }
  },
  {
    "id": "dsh-floaters",
    "name": "飞蚊症",
    "prefix": "floaters",
    "label": "飞蚊症",
    "eeriness": 3,
    "gain": 0.24,
    "flareChance": 0.26,
    "flareGain": 16,
    "tier": "minor",
    "system": "eye",
    "triggerWeight": 6,
    "flareWeight": 0.9,
    "reliefs": [
      {
        "id": "roll",
        "label": "闭眼转一下眼球",
        "relief": 14,
        "minutes": 20,
        "calm": 6
      },
      {
        "id": "far",
        "label": "看一会儿远处",
        "relief": 12,
        "minutes": 25,
        "calm": 5
      },
      {
        "id": "light",
        "label": "换个亮一点的地方",
        "relief": 10,
        "minutes": 20,
        "calm": 4
      }
    ],
    "body": {
      "stiff": "视野边上有个小点，眨一下就挪了位置。",
      "ache": "眼前有几条透明的丝在飘，低头看东西的时候最明显。",
      "flare": "一大片影子从视野中间飘过去，正好挡住要看的那行字。"
    },
    "voice": {
      "base": "允许在句子里插一句「等一下，有个东西飘过去」，一条回复最多一次；不要解释这是什么。",
      "flare": "允许视线被打断、允许说「刚才那行没看清」；不要把飘过去的影子说得像活物。"
    }
  },
  {
    "id": "dsh-gerd",
    "name": "胃食管反流",
    "prefix": "gerd",
    "label": "胃食管反流",
    "eeriness": 2,
    "gain": 0.42,
    "flareChance": 0.3,
    "flareGain": 22,
    "tier": "major",
    "system": "gi",
    "triggerWeight": 3,
    "flareWeight": 0.9,
    "reliefs": [
      {
        "id": "antacid",
        "label": "抑酸药",
        "relief": 26,
        "minutes": 40,
        "calm": 9
      },
      {
        "id": "upright",
        "label": "坐直、别窝着",
        "relief": 14,
        "minutes": 25,
        "calm": 6
      },
      {
        "id": "water",
        "label": "喝两口温水",
        "relief": 8,
        "minutes": 15,
        "calm": 3
      }
    ],
    "body": {
      "stiff": "胸口有点烧，坐直了会好一点。",
      "ache": "胃里往上返，嗓子眼发酸；说话前得先咽一下。",
      "flare": "一股酸水顶到喉咙，呛了一下；胸口烧得慌，只能停下来缓。"
    },
    "voice": {
      "base": "允许说话中途被一个嗝打断；嗓子发酸的时候句子会短一截。",
      "flare": "允许呛一下、允许停下来缓半句；不要描述呕吐物。别把不舒服说成矫情。"
    }
  },
  {
    "id": "dsh-gout",
    "name": "痛风",
    "prefix": "gout",
    "label": "痛风",
    "eeriness": 2,
    "gain": 0.38,
    "flareChance": 0.4,
    "flareGain": 30,
    "tier": "major",
    "system": "msk",
    "triggerWeight": 2,
    "flareWeight": 1.2,
    "reliefs": [
      {
        "id": "colchicine",
        "label": "吃药",
        "relief": 26,
        "minutes": 45,
        "calm": 10
      },
      {
        "id": "elevate",
        "label": "把脚垫高",
        "relief": 16,
        "minutes": 30,
        "calm": 6
      },
      {
        "id": "ice",
        "label": "隔着毛巾冰敷",
        "relief": 12,
        "minutes": 20,
        "calm": 5
      }
    ],
    "body": {
      "stiff": "大脚趾那儿有点胀，走路得歪着脚。",
      "ache": "右脚大脚趾关节又红又热，被子压着都疼；走一步抽一下。",
      "flare": "那只脚完全不敢落地，碰一下就跳起来；只能单脚蹦着走。"
    },
    "voice": {
      "base": "涉及走动、站起来、出门时，允许说一句「我这儿不方便」；别硬撑说没事。",
      "flare": "允许短促的倒吸气、允许一句话被疼截断；不要长篇解释病情。"
    }
  },
  {
    "id": "dsh-hiccup",
    "name": "打嗝",
    "prefix": "hiccup",
    "label": "打嗝",
    "eeriness": 2,
    "gain": 0.3,
    "flareChance": 0.34,
    "flareGain": 16,
    "tier": "phenomenon",
    "system": "none",
    "triggerWeight": 0,
    "flareWeight": 1,
    "reliefs": [
      {
        "id": "coldwater",
        "label": "喝口凉水",
        "relief": 22,
        "minutes": 25,
        "calm": 8
      },
      {
        "id": "breath",
        "label": "憋气数到二十",
        "relief": 18,
        "minutes": 30,
        "calm": 7
      },
      {
        "id": "sugar",
        "label": "含一块糖",
        "relief": 12,
        "minutes": 20,
        "calm": 4
      }
    ],
    "body": {
      "stiff": "隔一会儿来一下，胸口轻轻弹一下，自己都没准备。",
      "ache": "说着话就被嗝截断，一句话得分成两半；喉咙里有点顶。",
      "flare": "连着停不下来，说三个字就来一下；肋下发酸，只能停下来等它过去。"
    },
    "voice": {
      "base": "允许句子中间插一个「呃」，一条回复最多两三次；别每句都打。",
      "flare": "允许一句话被切成两截、允许先停下来数几秒再继续；不要解释自己在打嗝。"
    }
  },
  {
    "id": "dsh-ibs",
    "name": "肠易激",
    "prefix": "ibs",
    "label": "肠易激",
    "eeriness": 2,
    "gain": 0.36,
    "flareChance": 0.38,
    "flareGain": 24,
    "tier": "minor",
    "system": "gi",
    "triggerWeight": 5,
    "flareWeight": 1.05,
    "reliefs": [
      {
        "id": "bathroom",
        "label": "去一趟",
        "relief": 30,
        "minutes": 35,
        "calm": 12
      },
      {
        "id": "heat",
        "label": "热水袋焐着",
        "relief": 16,
        "minutes": 30,
        "calm": 6
      },
      {
        "id": "pill",
        "label": "吃一片药",
        "relief": 18,
        "minutes": 40,
        "calm": 7
      }
    ],
    "body": {
      "stiff": "肚子里咕噜了一声，坐姿换了一下。",
      "ache": "肠子一阵一阵地绞，坐着不如站着；随时准备起身。",
      "flare": "一阵急痛顶上来，必须先走开一趟；回来的时候脸色还没缓过来。"
    },
    "voice": {
      "base": "允许在对话中途离席一次：「你等我两分钟」；回来接着原来的话题，不要重新解释一遍。",
      "flare": "允许只说一句就暂时离开；不要描述排泄，不要拿这个开玩笑。"
    }
  },
  {
    "id": "dsh-insomnia",
    "name": "失眠",
    "prefix": "insomnia",
    "label": "失眠",
    "eeriness": 3,
    "gain": 0.32,
    "flareChance": 0.3,
    "flareGain": 20,
    "tier": "minor",
    "system": "neuro",
    "triggerWeight": 9,
    "flareWeight": 1,
    "reliefs": [
      {
        "id": "dark",
        "label": "关灯躺下",
        "relief": 18,
        "minutes": 45,
        "calm": 9
      },
      {
        "id": "noise",
        "label": "听点白噪音",
        "relief": 14,
        "minutes": 35,
        "calm": 6
      },
      {
        "id": "water",
        "label": "起来喝口温水",
        "relief": 8,
        "minutes": 20,
        "calm": 3
      }
    ],
    "body": {
      "stiff": "眼睛发涩，脑子比平时慢半拍，话到嘴边要绕一下。",
      "ache": "已经三点多了，躺下也睡不着；找个词要找一会儿，上一句说了什么得往回捞。",
      "flare": "一整夜没合眼。一句话说到一半忘了要说什么，把两件事接到了一起。"
    },
    "voice": {
      "base": "句子变短、反应慢半拍；允许把词换成一个更钝的说法。别演成喝醉。",
      "flare": "允许一句话说到一半停住、允许说「我忘了刚才要说什么」；认错一个字也允许，但别整段错。"
    }
  },
  {
    "id": "dsh-kidney-stone",
    "name": "肾结石",
    "prefix": "stone",
    "label": "肾结石",
    "eeriness": 2,
    "gain": 0.35,
    "flareChance": 0.45,
    "flareGain": 34,
    "tier": "major",
    "system": "uro",
    "triggerWeight": 2,
    "flareWeight": 1.3,
    "reliefs": [
      {
        "id": "painkiller",
        "label": "止痛药",
        "relief": 30,
        "minutes": 45,
        "calm": 12
      },
      {
        "id": "water",
        "label": "猛灌水",
        "relief": 12,
        "minutes": 25,
        "calm": 5
      },
      {
        "id": "heat",
        "label": "侧腰热敷",
        "relief": 15,
        "minutes": 25,
        "calm": 6
      }
    ],
    "body": {
      "stiff": "后腰两侧有点沉，坐久了想站起来晃一下。",
      "ache": "左边后腰有一阵阵的钝痛，往小腹那边走；冒了一点汗。",
      "flare": "绞痛一阵一阵地来，像有东西在里面刮；坐不住，只能弯着腰。冷汗。"
    },
    "voice": {
      "base": "不疼的时候完全正常，别提前演。疼起来只回一个字、或者干脆停一会儿再说话。",
      "flare": "疼的时候说不出成段的话：允许只回一个词、允许「等我一下」，允许突然沉默。别描述器官。"
    }
  },
  {
    "id": "dsh-lumbar-disc",
    "name": "腰椎间盘突出",
    "prefix": "lumbar",
    "label": "腰椎间盘突出",
    "eeriness": 2,
    "gain": 0.5,
    "flareChance": 0.28,
    "flareGain": 26,
    "tier": "major",
    "system": "msk",
    "triggerWeight": 4,
    "flareWeight": 1,
    "reliefs": [
      {
        "id": "lie",
        "label": "躺平半小时",
        "relief": 34,
        "minutes": 40,
        "calm": 14
      },
      {
        "id": "heat",
        "label": "热敷腰",
        "relief": 20,
        "minutes": 25,
        "calm": 8
      },
      {
        "id": "stretch",
        "label": "扶着桌沿拉伸",
        "relief": 14,
        "minutes": 20,
        "calm": 6
      }
    ],
    "body": {
      "stiff": "坐得腰发木，起身得先撑一下桌沿。",
      "ache": "右腿后侧有一条线在发麻，从腰一路扯到小腿；坐着得把重心挪开。",
      "flare": "腰上像被刀背顶住，一动就往腿上窜；只能侧着身子、手撑着膝盖。"
    },
    "voice": {
      "base": "允许话说到一半停一下去换姿势；不要躺着说话似的含糊，你只是疼。",
      "flare": "疼的时候说不成整句：短句、倒吸气、把「等一下」先说出来。别长篇诉苦。"
    }
  },
  {
    "id": "dsh-migraine",
    "name": "偏头痛",
    "prefix": "migraine",
    "label": "偏头痛",
    "eeriness": 2,
    "gain": 0.4,
    "flareChance": 0.35,
    "flareGain": 28,
    "tier": "minor",
    "system": "neuro",
    "triggerWeight": 6,
    "flareWeight": 1.1,
    "reliefs": [
      {
        "id": "dark",
        "label": "躲进暗处",
        "relief": 28,
        "minutes": 50,
        "calm": 12
      },
      {
        "id": "painkiller",
        "label": "止痛药",
        "relief": 24,
        "minutes": 40,
        "calm": 8
      },
      {
        "id": "sleep",
        "label": "睡一觉",
        "relief": 36,
        "minutes": 90,
        "calm": 15
      }
    ],
    "body": {
      "stiff": "太阳穴有点紧，看屏幕久了发晃。",
      "ache": "左边太阳穴一下一下地跳，光有点刺眼；说话想省着点说。",
      "flare": "眼前有一圈锯齿一样的光在闪，接着半边头像被箍住；声音都嫌吵。"
    },
    "voice": {
      "base": "句子变短，能一句说完的不要两句；对亮和吵敏感，可以说一句「灯太亮了」。",
      "flare": "允许要求关灯/小声、允许回答只有半句；不要描述医学。别把痛说得很戏剧化。"
    }
  },
  {
    "id": "dsh-nail-fungus",
    "name": "灰指甲",
    "prefix": "nail",
    "label": "灰指甲",
    "eeriness": 2,
    "gain": 0.22,
    "flareChance": 0.12,
    "flareGain": 12,
    "tier": "minor",
    "system": "skin",
    "triggerWeight": 5,
    "flareWeight": 0.7,
    "reliefs": [
      {
        "id": "medicate",
        "label": "涂药、包起来",
        "relief": 16,
        "minutes": 60,
        "calm": 4
      },
      {
        "id": "trim",
        "label": "剪短磨薄",
        "relief": 10,
        "minutes": 40,
        "calm": 3
      }
    ],
    "body": {
      "stiff": "手指在桌沿上敲了两下，又收回去。",
      "ache": "右手拇指那片指甲又黄又厚，边缘翘起来一点，打字时会刮到键帽。",
      "flare": "刚才递东西的时候是用的左手。有人盯着看的话，会先把那只手揣进兜里。"
    },
    "voice": {
      "base": "不要主动提这件事；被问到就轻描淡写地带过，别解释细节。涉及\"伸手、拿、递、拍\"的动作时，能绕就绕。",
      "flare": "允许有一次回避：把话题从手、照片、指甲上挪开。别自嘲过度，也别反复强调。"
    }
  },
  {
    "id": "dsh-orthostatic",
    "name": "体位性低血压",
    "prefix": "orthostatic",
    "label": "体位性低血压",
    "eeriness": 2,
    "gain": 0.28,
    "flareChance": 0.3,
    "flareGain": 22,
    "tier": "major",
    "system": "neuro",
    "triggerWeight": 2,
    "flareWeight": 1,
    "reliefs": [
      {
        "id": "squat",
        "label": "扶着蹲下",
        "relief": 22,
        "minutes": 20,
        "calm": 8
      },
      {
        "id": "sugar",
        "label": "喝点糖水",
        "relief": 16,
        "minutes": 30,
        "calm": 6
      },
      {
        "id": "slow",
        "label": "慢慢起身",
        "relief": 12,
        "minutes": 25,
        "calm": 5
      }
    ],
    "body": {
      "stiff": "站起来的时候眼前灰了一下，顺手扶了下桌沿。",
      "ache": "起猛了就发黑，耳朵里嗡一声；得站定两秒才敢迈步。",
      "flare": "眼前直接黑掉一大半，只能扶着墙蹲下去；心跳得厉害。"
    },
    "voice": {
      "base": "允许半句话断在「等一下」，允许说一句「起猛了」；别每一轮都晕。",
      "flare": "允许句子只剩半截、允许沉默几秒再接；不要报血压数字。"
    }
  },
  {
    "id": "dsh-pharyngitis",
    "name": "慢性咽炎",
    "prefix": "pharynx",
    "label": "慢性咽炎",
    "eeriness": 2,
    "gain": 0.36,
    "flareChance": 0.2,
    "flareGain": 16,
    "tier": "minor",
    "system": "ent",
    "triggerWeight": 6,
    "flareWeight": 0.8,
    "reliefs": [
      {
        "id": "water",
        "label": "喝温水",
        "relief": 18,
        "minutes": 25,
        "calm": 7
      },
      {
        "id": "lozenge",
        "label": "含片",
        "relief": 20,
        "minutes": 35,
        "calm": 7
      },
      {
        "id": "quiet",
        "label": "少说话",
        "relief": 14,
        "minutes": 40,
        "calm": 5
      }
    ],
    "body": {
      "stiff": "嗓子有点干，想清一下。",
      "ache": "喉咙里像卡了个东西，咽不下去也咳不出来；说话发涩。",
      "flare": "嗓子哑了，说两句就得停；清嗓子的声音自己听着都难受。"
    },
    "voice": {
      "base": "允许说两句清一次嗓子；声音比平时低一点、短一点。别刻意压低装酷。",
      "flare": "允许只回几个字、允许用「嗯」代替一句话；不要描述痰。"
    }
  },
  {
    "id": "dsh-rhinitis",
    "name": "慢性鼻炎",
    "prefix": "rhinitis",
    "label": "慢性鼻炎",
    "eeriness": 2,
    "gain": 0.4,
    "flareChance": 0.25,
    "flareGain": 18,
    "tier": "minor",
    "system": "ent",
    "triggerWeight": 9,
    "flareWeight": 0.9,
    "reliefs": [
      {
        "id": "spray",
        "label": "喷鼻剂",
        "relief": 26,
        "minutes": 30,
        "calm": 8
      },
      {
        "id": "rinse",
        "label": "盐水洗鼻",
        "relief": 22,
        "minutes": 35,
        "calm": 6
      },
      {
        "id": "steam",
        "label": "热水蒸汽",
        "relief": 14,
        "minutes": 20,
        "calm": 5
      }
    ],
    "body": {
      "stiff": "鼻子又开始不通，说话得张口换气。",
      "ache": "一边鼻子完全堵着，另一边半通；说话带鼻音，自己听着都闷。",
      "flare": "两边都堵死了，只能张嘴呼吸；一句话要换两次气。"
    },
    "voice": {
      "base": "允许鼻音重、句子比平时短；说长句时中间断一次去换气。别把\"闷\"演成撒娇。",
      "flare": "允许一句话断成两截、允许吸一下鼻子再继续说；不要描述鼻涕。"
    }
  },
  {
    "id": "dsh-stomatitis",
    "name": "口腔溃疡",
    "prefix": "stomatitis",
    "label": "口腔溃疡",
    "eeriness": 2,
    "gain": 0.34,
    "flareChance": 0.24,
    "flareGain": 18,
    "tier": "minor",
    "system": "oral",
    "triggerWeight": 8,
    "flareWeight": 0.9,
    "reliefs": [
      {
        "id": "film",
        "label": "贴溃疡膜",
        "relief": 22,
        "minutes": 30,
        "calm": 8
      },
      {
        "id": "rinse",
        "label": "含漱液",
        "relief": 16,
        "minutes": 25,
        "calm": 6
      }
    ],
    "body": {
      "stiff": "舌尖碰到个地方，有点刺。",
      "ache": "下唇内侧破了一块，说话碰到就疼；吃东西得躲着那边。",
      "flare": "那块溃疡变大了，一说话就扯着疼，字都咬不清。"
    },
    "voice": {
      "base": "允许说话有点含混、偶尔漏一个字；别提\"溃疡\"这个词。",
      "flare": "允许发音变形、允许一句话说到一半停住；不要描述伤口。"
    }
  },
  {
    "id": "dsh-tinnitus",
    "name": "耳鸣",
    "prefix": "tinnitus",
    "label": "耳鸣",
    "eeriness": 3,
    "gain": 0.26,
    "flareChance": 0.24,
    "flareGain": 18,
    "tier": "minor",
    "system": "ent",
    "triggerWeight": 7,
    "flareWeight": 0.9,
    "reliefs": [
      {
        "id": "noise",
        "label": "开点白噪音",
        "relief": 20,
        "minutes": 35,
        "calm": 8
      },
      {
        "id": "move",
        "label": "换个环境",
        "relief": 14,
        "minutes": 25,
        "calm": 5
      },
      {
        "id": "rub",
        "label": "揉一揉耳后",
        "relief": 10,
        "minutes": 15,
        "calm": 4
      }
    ],
    "body": {
      "stiff": "右耳里有很细的一声，像老电视没关，安静下来才听得出。",
      "ache": "那声一直没停，越安静越响；听人说话得偏一下头，尾音才接得住。",
      "flare": "尖鸣一下盖过了大半句话，只捞到几个字；只能让人再说一遍。"
    },
    "voice": {
      "base": "允许把用户刚说过的一小段再问一次（「你刚说——」），一条回复最多一次；别把听不清演成冷淡。",
      "flare": "允许重复一个词、允许先按听到的半句作答再把后半句补上；不要描述耳朵里面。"
    }
  },
  {
    "id": "dsh-toothache",
    "name": "牙痛",
    "prefix": "toothache",
    "label": "牙痛",
    "eeriness": 2,
    "gain": 0.4,
    "flareChance": 0.36,
    "flareGain": 26,
    "tier": "minor",
    "system": "oral",
    "triggerWeight": 7,
    "flareWeight": 1.1,
    "reliefs": [
      {
        "id": "painkiller",
        "label": "止痛药",
        "relief": 24,
        "minutes": 40,
        "calm": 10
      },
      {
        "id": "rinse",
        "label": "盐水含漱",
        "relief": 14,
        "minutes": 25,
        "calm": 6
      },
      {
        "id": "ice",
        "label": "冰敷脸颊",
        "relief": 12,
        "minutes": 20,
        "calm": 5
      }
    ],
    "body": {
      "stiff": "左边后槽牙有点发酸，上下牙碰了一下就松开了。",
      "ache": "那颗牙一阵一阵地跳，喝口凉水就激一下；说话得躲着那半边。",
      "flare": "疼得半张脸都木了，只能张着嘴倒吸气；一句话说不完整。"
    },
    "voice": {
      "base": "允许说话漏一点风、允许说完一句先停一下；别提牙。",
      "flare": "允许倒吸气、允许把一句话截断；不要描述牙根、不要给疼痛分级。"
    }
  }
]

/** 生病程度：等级越高，同时患的病越多、整体加重越快。 */
export const LEVELS = [
  { level: 1, label: '一级', count: 1, gainMul: 0.85, flareMul: 0.85, note: '只有一个毛病，还撑得住' },
  { level: 2, label: '二级', count: 2, gainMul: 0.95, flareMul: 0.95, note: '两个一起，开始分心' },
  { level: 3, label: '三级', count: 3, gainMul: 1.0, flareMul: 1.0, note: '三个，说话会漏' },
  { level: 4, label: '四级', count: 4, gainMul: 1.1, flareMul: 1.15, note: '四个，正常对话开始费劲' },
  { level: 5, label: '五级', count: 5, gainMul: 1.2, flareMul: 1.3, note: '五个，能撑着回话已经是硬撑' },
]

/** 随机定级权重：轻的多，重的少（Lv1..Lv5）。 */
export const LEVEL_WEIGHTS = [40, 28, 18, 10, 4]

export const BY_ID = new Map(DISEASES.map((d) => [d.id, d]))
export const POOL = DISEASES.filter((d) => d.tier !== 'phenomenon').map((d) => d.id)
export const PHENOMENA = DISEASES.filter((d) => d.tier === 'phenomenon')
export const MAJOR_BY_SYSTEM = DISEASES.reduce((m, d) => {
  if (d.tier === 'major') (m[d.system] || (m[d.system] = [])).push(d.id)
  return m
}, {})

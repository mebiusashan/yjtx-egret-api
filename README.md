## TS api 生成器

生成出 ts 对应的 api 数据以及显示

### 命令

~~~
node api/tscdoc.js --path ../../Egret/egret-core/egret-core-master/src --output test/data/ --examples ../../Egret/egret-examples/CoreExample/src --language zh_cn --type egret
~~~

* --path 传递需要解析ts文件夹路径。

* --output api 解析完后的存放的路径

* --examples 代码中对应 includeExample 的跟路径。可不填

* --language 代码块中对应的语言版本。忽略大小写
    zh_cn
    en_us

* --type 对应配置文件的名称。比如 egret，则需要配置文件 egret_modules.json

~~~
{
    "modules": {
        "egret": "egret",
        "game": "extension/game",
        "gui": "extension/gui",
        "res": "extension/resource",
        "eui": "extension/eui",
        "tween": [
            "extension/tween",
            "extension/socket"
        ],
        "dragonbones": "extension/dragonbones"
    },
    "exclude" : [
    ]
}
~~~

* modules 生成的对应组，可以同时包含多个

* exclude 不希望加入到生成列表的文件


### 运行

在 test 文件夹中，通过 server 运行 index.html，可以直接查看显示的结果。

<http://yjtxlib.com/yjtx-egret-api/test/>

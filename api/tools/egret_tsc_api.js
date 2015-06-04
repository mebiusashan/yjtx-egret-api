/**
 * Created by wander on 14-9-15.
 */


var file = require("../core/file.js");
var trim = require("../core/trim");
var globals = require("../core/globals");
var path = require("path");

var flags = require("../tools/enumflag").getEnumFlag();

function typeScriptCompiler(quitFunc,cmd) {
    file.save("tsc_config_temp.txt", cmd);//todo performance-optimize
    var TypeScript = require('../tools/enumflag').getTscApi();

    TypeScript.exit = function(){
        setTimeout(quitFunc,1,arguments[0])
    };

    var nameArr = [];

    var objArr = [];

    var apiArr = [];
    var dtsArr = [];
    var arr = TypeScript.executeApi(["@tsc_config_temp.txt"]);
    arr.forEach(function (item) {
        if (item.filename.indexOf(".d.ts") >= 0) {
            dtsArr.push(item.locals);
        }
        else {
            objArr.push(item.locals);

            nameArr.push(item.filename);

            var root = {"filename" : item.filename, "$_tree_":{}};
            apiArr.push(root);
            for (var key in item.locals) {
                if (key == "NaN" || key == "__proto__") {
                    continue;
                }
                check(item.locals[key], root["$_tree_"], item.text);
            }
        }
    });

    return apiArr;
}

function check(obj, parent, text) {
    var objName = obj.name;
    if (obj.name == "__constructor") {
        objName = "constructor";
        parent[objName] = {};
        parent[objName]["api"] = text.substring(obj.declarations[0].pos, obj.declarations[0].end);

        addDoc(parent[objName]["api"], parent[objName]);
    }
    else if (obj.valueDeclaration) {
        parent[objName] = {};
        parent[objName]["api"] = text.substring(obj.valueDeclaration.pos, obj.valueDeclaration.end);

        addDoc(parent[objName]["api"], parent[objName]);
    }
    else {
        parent[objName] = {};
    }


    switch (obj.flags) {
        case flags["ValueModule"]: //ValueModule
        case flags["NamespaceModule"]: //NamespaceModule
        case flags["Module"]: //NamespaceModule
        {
            parent[objName]["$_tree_"] = {};

            parent[objName]["bodyType"] = "module";
            for (var key in obj.exports) {
                if (["__proto__", "flags", "mergeId", "name", "parent"].indexOf(key) >= 0) {
                    continue;
                }

                check(obj.exports[key], parent[objName]["$_tree_"], text);
            }

            break;
        }
        case flags["FunctionScopedVariable"]://module var
        case flags["BlockScopedVariable"]://module var
        {
            parent[objName]["api"] = text.substring(obj.valueDeclaration.parent.pos, obj.valueDeclaration.parent.end);
            addDoc(parent[objName]["api"], parent[objName]);

            parent[objName]["bodyType"] = "modulevar";

            if (obj.valueDeclaration && obj.valueDeclaration.type) {
                parent[objName]["type"] = text.substring(obj.valueDeclaration.type.pos, obj.valueDeclaration.type.end);
            }
            addPublic(parent[objName]["content"], parent[objName], objName);
            break;
        }
        case flags["Property"]://变量
        {
            parent[objName]["bodyType"] = "var";

            if (obj.valueDeclaration && obj.valueDeclaration.type) {
                parent[objName]["type"] = text.substring(obj.valueDeclaration.type.pos, obj.valueDeclaration.type.end);
            }

            var content = parent[objName]["content"];
            addStatic(content, parent[objName]);

            //获取值
            var firstIdx = content.indexOf('=');
            var endIdx = content.indexOf(';');
            if (endIdx > 0) {
                parent[objName]["value"] = trim.trimAll(content.substring(firstIdx + 1, endIdx));
            }
            else {
                parent[objName]["value"] = trim.trimAll(content.substring(firstIdx + 1));
            }

            addPublic(content, parent[objName], objName);
            break;
        }
        case flags["GetAccessor"]://module var  get
        {
            parent[objName]["bodyType"] = "get";

            for (var i = 0; i < obj.declarations.length; i++) {
                var decla = obj.declarations[i];
                if (decla.parameters.length == 1) {//使用set
                }
                else {
                    initGetParamObject(parent[objName], decla, text);
                }
            }

            if (obj.valueDeclaration && obj.valueDeclaration.type) {
                parent[objName]["type"] = text.substring(obj.valueDeclaration.type.pos, obj.valueDeclaration.type.end);
            }

            break;
        }
        case flags["SetAccessor"]://module var set
        {
            parent[objName]["bodyType"] = "set";

            for (var i = 0; i < obj.declarations.length; i++) {
                var decla = obj.declarations[i];
                if (decla.parameters.length == 1) {//使用set
                    initSetParamObject(parent[objName], decla, text);
                }
            }

            if (obj.valueDeclaration && obj.valueDeclaration.type) {
                parent[objName]["type"] = text.substring(obj.valueDeclaration.type.pos, obj.valueDeclaration.type.end);
            }

            break;
        }
        case flags["Accessor"]://module var set get
        {
            parent[objName]["bodyType"] = "set get";

            for (var i = 0; i < obj.declarations.length; i++) {
                var decla = obj.declarations[i];
                if (decla.parameters.length == 1) {//使用set
                    initSetParamObject(parent[objName], decla, text);
                }
                else {
                    initGetParamObject(parent[objName], decla, text);
                }
            }

            if (obj.valueDeclaration && obj.valueDeclaration.type) {
                parent[objName]["type"] = text.substring(obj.valueDeclaration.type.pos, obj.valueDeclaration.type.end);
            }

            break;
        }
        case flags["Function"]://方法
        {
            parent[objName]["bodyType"] = "modulefunction";
            if (obj.valueDeclaration && obj.valueDeclaration.parameters) {
                parent[objName]["parameters"] = [];

                addParams(obj.valueDeclaration.parameters, parent[objName]["parameters"], text);
            }

            if (obj.valueDeclaration && obj.valueDeclaration.type) {
                parent[objName]["type"] = text.substring(obj.valueDeclaration.type.pos, obj.valueDeclaration.type.end);
            }

            addPublic(parent[objName]["content"], parent[objName], objName);
            break;
        }
        case flags["Constructor"]://构造函数
        {
            parent[objName]["bodyType"] = "function";

            var declarations = obj.declarations[0];

            if (declarations && declarations.parameters) {
                parent[objName]["parameters"] = [];

                addParams(declarations.parameters, parent[objName]["parameters"], text);
            }

            parent[objName]["type"] = null;
            addStatic(parent[objName]["content"], parent[objName]);
            addPublic(parent[objName]["content"], parent[objName], objName);
            break;
        }
        case flags["Method"]://方法
        {
            parent[objName]["bodyType"] = "function";

            if (obj.valueDeclaration && obj.valueDeclaration.parameters) {
                parent[objName]["parameters"] = [];

                addParams(obj.valueDeclaration.parameters, parent[objName]["parameters"], text);
            }

            if (obj.valueDeclaration && obj.valueDeclaration.type) {
                parent[objName]["type"] = text.substring(obj.valueDeclaration.type.pos, obj.valueDeclaration.type.end);
            }
            addStatic(parent[objName]["content"], parent[objName]);
            addPublic(parent[objName]["content"], parent[objName], objName);
            break;
        }
        case flags["Interface"]://接口
        {
            parent[objName]["$_tree_"] = {};
            parent[objName]["bodyType"] = "interface";
            for (var key in obj.members) {
                if (["__proto__", "name"].indexOf(key) >= 0) {
                    continue;
                }

                check(obj.members[key], parent[objName]["$_tree_"], text);
            }

            for (var key in obj.exports) {
                if (["__proto__", "flags", "id"].indexOf(key) >= 0) {
                    continue;
                }

                check(obj.exports[key], parent[objName]["$_tree_"], text);
            }

            if (obj["declarations"] && obj["declarations"].length) {
                var docInfo = obj["declarations"][0];
                if (docInfo["baseTypes"] && docInfo["baseTypes"].length) {
                    initExtends(docInfo["baseTypes"][0], parent[objName], text);
                }

                parent[objName]["api"] = text.substring(docInfo.pos, docInfo.end);

                addDoc(parent[objName]["api"], parent[objName]);
            }
            break;
        }
        case flags["Class"]://类
        {
            parent[objName]["$_tree_"] = {};
            parent[objName]["bodyType"] = "class";

            for (var key in obj.members) {
                if (["__proto__", "name"].indexOf(key) >= 0) {
                    continue;
                }
                check(obj.members[key], parent[objName]["$_tree_"], text);
            }

            for (var key in obj.exports) {
                if (["__proto__", "flags", "id"].indexOf(key) >= 0) {
                    continue;
                }

                check(obj.exports[key], parent[objName]["$_tree_"], text);
            }

            if (obj["valueDeclaration"]) {
                initExtends(obj["valueDeclaration"]["baseType"], parent[objName], text);
                initImplements(obj["valueDeclaration"]["implementedTypes"], parent[objName], text);
            }
            break;
        }

    }
}

function addDoc(text, obj) {
    text = text.replace(/^(\s)*/, "");
    if (text.charAt(0) != "/") {

    }
    else {

        var arr = [];
        while (text.charAt(0) == "/") {
            if (text.charAt(1) == "*") {
                var last = text.indexOf("*/");

                arr.push(text.substring(0, last + 2));

                text = text.substring(last + 2);

                text = text.replace(/^(\s)*/, "");
            }
            else {
                //arr.push(text.match(/(.)*/)[0]);
                text = text.replace(/(.)*/, "");

                text = text.replace(/^(\s)*/, "");
            }
        }

        var brr = [];
        var crr = [];
        if (arr.length) {
            for (var i = 0; i < arr.length; i++) {
                var doc = arr[i];

                doc = doc.replace(/^\/(\/)+/, "");
                doc = doc.replace(/(\n\r|\r\n|\n|\r)/g, "\n");

                doc = doc.replace(/^\/(\*)+/, "");
                doc = doc.replace(/(\*)+\/$/, "");

                doc = doc.replace(/(\n)(\s)*(\*)+@/g, "\n@");

                doc = doc.replace(/(\n)(\s)*(\*)+[^\S\n]?/g, "\n");

                //去掉 @member
                doc = doc.replace(/@member.*/, "");
                //去掉 @method
                doc = doc.replace(/@method.*/, "");
                //去掉 @class
                doc = doc.replace(/@class .*/, "");
                //去掉 @extends
                doc = doc.replace(/@extends.*/, "");
                //去掉 @constant
                doc = doc.replace(/@constant.*/, "");
                //去掉 @constructor
                doc = doc.replace(/@constructor.*/, "");
                //去掉 @implements
                doc = doc.replace(/@implements.*/, "");

                doc = doc.replace(/^(\s)*/, "");
                doc = doc.replace(/(\s)*$/, "");
                brr[i] = doc;

                crr.push(analyze(doc));
            }

            //obj["docapi"] = arr;
            //obj["docapin"] = brr;
            obj["docs"] = crr;
        }

    }


    if (text.indexOf("{") >= 0) {
        obj["content"] = text.substring(0, text.indexOf("{"));
    }
    else {
        obj["content"] = text;
    }
}

//加入是否是static
function addStatic(content, obj) {
    //判断是否是 static
    if (content.match(/(^static )|( static )/)) {
        obj["scope"] = "static";
    }
    else {
        obj["scope"] = "instance";
    }
}

//是否是public
function addPublic(content, obj, name) {
    //判断是否是 static
    if (content.match(/(^private )|( private )/)) {
        obj["pType"] = "private";
    }
    if (content.match(/(^protected )|( protected )/)) {
        obj["pType"] = "protected";
    }
    else {
        if (name.charAt(0) == "_") {
            obj["pType"] = "protected";
        }
        else if (name.charAt(0) == "$") {
            obj["pType"] = "private";
        }
        else {
            obj["pType"] = "public";
        }
    }
}

//参数列表
function addParams(parameters, parametersArr, text) {
    for (var i = 0; i < parameters.length; i++) {
        var param = parameters[i];

        var p = {};

        var value = text.substring(param.pos, param.end);
        if (value.indexOf("...") >= 0) {
            p["name"] = "..." + param.name.text;
        }
        else if (param.name) {
            p["name"] = param.name.text;
        }

        if (param.type) {
            p["type"] = text.substring(param.type.pos, param.type.end)
        }
        parametersArr.push(p);
    }
}

//set 参数列表
function initGetParamObject(obj, decla, text) {
    obj["get"] = {};
    obj["get"]["api"] = text.substring(decla.pos, decla.end);
    addDoc(obj["get"]["api"], obj["get"]);

    obj["get"]["parameters"] = [];
    addParams(decla.parameters, obj["get"]["parameters"], text);
}

//get 参数列表
function initSetParamObject(obj, decla, text) {
    obj["set"] = {};
    obj["set"]["api"] = text.substring(decla.pos, decla.end);
    addDoc(obj["set"]["api"], obj["set"]);

    obj["set"]["parameters"] = [];
    addParams(decla.parameters, obj["set"]["parameters"], text);
}

//extends
function initExtends(baseType, obj, text) {
    if (baseType == null) {
        return;
    }
    obj["extends"] = baseType["typeName"]["text"] || text.substring(baseType["typeName"].pos, baseType["typeName"].end);
}

//implements
function initImplements(implementedTypes, obj, text) {
    if (implementedTypes == null) {
        return;
    }
    obj["implements"] = [];
    for (var i = 0; i < implementedTypes.length; i++) {
        obj["implements"].push(implementedTypes[i]["typeName"]["text"] || text.substring(baseType["typeName"].pos, baseType["typeName"].end));
    }
}

function analyze(doc) {
    var docs;

    docs = doc.split(/\n\@/);
    if (docs == null) {
        docs = [doc];
    }

    var docInfo = {};
    for (var i = 0; i < docs.length; i++) {
        var item = docs[i];
        item = item.replace(/^(\s)*/, "");
        if (item == "") {
            continue;
        }

        //描述
        if (i == 0 && item.charAt(0) != "@") {
            docInfo["description"] = item;
            continue;
        }
        else if (i == 0) {
            item = item.substring(1);
        }

        if (item.indexOf("classdesc") == 0) {//兼容类描述
            if (item.match(/^classdesc(\s)+/)) {
                var temp = item.match(/^classdesc(\s)+/)[0];
                if (docInfo["description"] == null) {
                    docInfo["description"] = item.substring(temp.length);
                }
                else {
                    docInfo["description"] += "\n" + item.substring(temp.length);
                }
            }
            else {
                //console.log("sdf");
            }
        }
        else if (item.indexOf("private") == 0) {//private
            docInfo["private"] = true;
        }
        else if (item.indexOf("deprecated") == 0) {//deprecated
            docInfo["deprecated"] = true;
        }
        else if (item.indexOf("inheritDoc") == 0) {//deprecated
            docInfo["inheritDoc"] = true;
        }
        else if (item.indexOf("param") == 0) {//param
            if (docInfo["params"] == null) {
                docInfo["params"] = {};
            }

            var itemArr = item.split(/^param(\s)+/);
            var paramName = itemArr[itemArr.length - 1].match(/^(\S)+/)[0];

            itemArr = itemArr[itemArr.length - 1].split(/^(\S)+(\s)+(\{(\s|\S)*\})?(\s)*/);
            var des = "";
            des = itemArr[itemArr.length - 1];

            docInfo["params"][paramName] = des;
        }
        else if (item.indexOf("example") == 0) {//example
            docInfo["example"] = {};
            var temp = item.match(/^example(\s)+/)[0];
            var des1 = item.substring(temp.length);

            var reg = /<code>[\s\S]*<\/code>/;
            if (des1.match(reg)) {
                var code = des1.match(reg)[0];
                docInfo["example"]["code"] = des1.substring(des1.indexOf("<code>") + 6, des1.indexOf("</code>"));
                des1 = des1.replace(code, "");
            }
            docInfo["example"]["description"] = trim.trimAll(des1);
        }
        else if (item.indexOf("includeExample") == 0) {//example
            docInfo["example"] = {};
            var tname = item.match(/^includeExample(\s)+/)[0];
            var url = trim.trimAll(item.substring(tname.length));
            docInfo["example"]["code"] = file.read(path.join(globals.getExampleRootPath(), url));
            docInfo["example"]["description"] = "";
        }
        else if (item.indexOf("return") == 0) {//return(s)
            var temp = item.match(/^return(s)?(\s)+(\{[\s\S]*\})?(\s)*/)[0];

            docInfo["return"] = item.substring(temp.length);
        }
        else if (item.indexOf("event") == 0) {//event
            var temp = item.match(/^event(\s)+/)[0];
            if (docInfo["event"] == null) {
                docInfo["event"] = [];
            }
            var des1 = trim.trimAll(item.substring(temp.length));
            var eventType = des1.match(/(\S)+/)[0];
            var des2 = trim.trimAll(des1.substring(eventType.length));
            docInfo["event"].push({"name" : eventType, "description" : des2});
        }
        else if (item.indexOf("link") == 0) {
            var temp = item.match(/^link(\s)+/)[0];
            docInfo["link"] = item.substring(temp.length);
        }
        else if (item.indexOf("see") == 0) {
            var temp = item.match(/^see(\s)+/)[0];
            if (docInfo["see"] == null) {
                docInfo["see"] = [];
            }
            docInfo["see"].push(trim.trimAll(item.substring(temp.length)));
        }
        else if (item.indexOf("state") == 0) {//state
            var temp = item.match(/^state(\s)+/)[0];
            if (docInfo["state"] == null) {
                docInfo["state"] = [];
            }
            var des1 = trim.trimAll(item.substring(temp.length));
            var eventType = des1.match(/(\S)+/)[0];
            var des2 = trim.trimAll(des1.substring(eventType.length));
            docInfo["state"].push({"name" : eventType, "description" : des2});
        }
        else if (item.indexOf("skinPart") == 0) {//skinPart
            var temp = item.match(/^skinPart(\s)+/)[0];
            if (docInfo["skinPart"] == null) {
                docInfo["skinPart"] = [];
            }
            var des1 = trim.trimAll(item.substring(temp.length));
            var eventType = des1.match(/(\S)+/)[0];
            var des2 = trim.trimAll(des1.substring(eventType.length));
            docInfo["skinPart"].push({"name" : eventType, "description" : des2});
        }
        else {//其他非特殊的标签  default version platform
            var docName = item.match(/^(\S)+/)[0];
            docInfo[docName] = trim.trimAll(item.substring(docName.length) || "");
        }
    }

    return docInfo;
}

exports.compile = typeScriptCompiler;
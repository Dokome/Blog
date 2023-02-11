---
theme: cyanosis
---

在我们日常开发中经常能用到 `vue-cli` 或者 `create-react-app` 等脚手架去创建项目的模板。但对于不同的开发者或者团队有着不同的配置以及习惯。我们往往需要在这些官方的 cli 上进行额外的配置，此时一个项目脚手架能很好地去对这些配置进行复用，对个人或者团队的经验积累也是很有帮助的。

### figma/create-widget 简介
> https://github.com/figma/create-widget

最近本人在做 figma 插件相关需求，figma 官方为开发者提供了一套项目模板脚手架。阅读了其代码后，感觉非常适合作为入门项目，故和大家分享一下～ 😀

### 快速上手
话不多说，先体验一下这个脚手架的功能。
```shell
npm init @figma/widget
```
都是很常规的个性化选项，选择完之后便帮我们下载好了模板并安装了相关的依赖。

![widget](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80da3d388859477b9c8b1a54cae1e737~tplv-k3u1fbpfcp-zoom-1.image)

### 流程分析
简单分析一下这个创建的过程。
#### npm init
在看源代码之前，我们先来看看 `npm init` 这个功能，通常我们初始化项目生成 `package.json` 经常能用到 `npm init -y`，在他后面添加了不同的参数代表着什么呢。

```shell
npm init [--force|-f|--yes|-y|--scope] 
npm init <@scope> (same as `npx <@scope>/create`) 
npm init [<@scope>/]<name> (same as `npx [<@scope>/]create-<name>`)
```
首先我们看到 `init` 指令对应的使用方式，在这个项目中 figma 使用了第三种用法。我们用 `npm init @figma/widget`,相当于执行了 `npx @figma/create-widget`，那他具体做了什么呢，我们接着往下看一下文档的说明

> `npm init <initializer>` can be used to set up a new or existing npm package.
`initializer` in this case is an npm package named `create-<initializer>`, which will be installed by [``](https://npm.im/npx)`npx`, and then have its main bin executed -- presumably creating or updating `package.json` and running any other initialization-related operations.

大意是我们可以通过这个指令让 `npx` 去安装这个项目，并能执行这个项目中的 **main bin**，相信有的人已经猜到了，我们可以在这个 **main bin** 里面去做项目的初始化。说到这里，我们看一下 @figma/create-widget 是怎么写的。

```json
{
  "name": "@figma/create-widget",
  "repository": "git@github.com:figma/create-widget.git",
  "version": "1.0.7",
  "description": "Create a widget from figma widget templates",
  "type": "module",
  "bin": {
    "create-widget": "./cli.js"
  },
  ...
}
```
在它的 `package.json` 中定义了一个 `create-widget` 指令，在我们执行了 `init` 的指令之后便会执行这个 `create-widget` 了。

#### 指令注册
首先我们进入上面提到的 cli.js 文件，我们发现它引入了 [sade](https://github.com/lukeed/sade) ，这个库为脚手架注册了一些选项，并在 action 回调中调用了 `createWidget` 这个方法。关于 sade 大家可以在它的文档中学习具体用法，此处就不展开了，类似的工具也有很多。
```javascript
#!/usr/bin/env node
import sade from "sade";
import { createWidget } from "./create-widget.js";

const description = `
    Create a FigJam widget with a single command

  Examples
    $ npm init @figma/widget
    $ npm init @figma/widget -n Counter
    $ npm init @figma/widget -n Counter -p counter-widget 
    --iframe=Y --editor-type figma,figjam
`;

sade("create-widget", true)
  .describe(description)
  .option("-n, --name", 'Name of your widget; defaults to "Widget"')
  .option(
    "-p, --package-name",
    'Name of the folder containing your widget; defaults to "<name>-widget"'
  )
  .option(
    "-e, --editor-type",
    'Editor type of widget; enter [figma | figjam | figma,figjam]; 
    defaults to "figjam"'
  )
  .option("-i, --iframe", "Whether the widget uses an iframe")
  .action(async function (options) {
    await createWidget({ options });
  })
  .parse(process.argv);
  
```

#### 命令行交互
在输入了指令之后就正式进入了选择配置的过程，我们进入 `createWidget` 这个函数看看里面发生了啥。
```javascript
export async function createWidget(input) {
  try {
    let widgetName = input.options.name;
    if (widgetName === undefined) {
      const result = await inquirer.prompt([
        {
          message:
            'Enter the name of your widget: (empty defaults to "Widget")',
          name: "widgetName",
          type: "input",
        },
      ]);
      widgetName = result.widgetName ? result.widgetName : "Widget";
    }
    ... 
    // 类似过程省略
}
```
在这个函数中，脚手架使用了 [inquirer](https://github.com/SBoudrias/Inquirer.js) 进行用户输入的处理，inquirer 这个库除了提供文本输入的功能以外，还有我们常见的如单选、多选等功能。在拿到用户输入或选择的配置后，我们就可以根据用户选择的结果做不同的操作了。

在处理完用户输入后我们往下看看代码中还有啥操作，此时函数名已经告诉了我们～
- 拷贝模板文件
- 替换模板中的变量
- 安装依赖

```javascript
    await copyTemplateFiles(directoryPath, shouldAddUI);
    await replaceTemplatizedValues(directoryPath, {
      widgetName,
      widgetId: randomWidgetId(),
      widgetEditorType: editorType,
      packageName: widgetName.toLowerCase(),
    });

    console.log("Installing dependencies...");
    await installDependencies(directoryPath, widgetName, destinationPath);
```

#### 拷贝模板
在这个函数中我们拿到了目标下载路径以及模板选择参数，然后利用了 `fs.copy` 将脚手架中的选好的模板复制到了目标文件夹下。

```javascript
async function copyTemplateFiles(pluginDirectoryPath, shouldAddUI) {
  const templateName = shouldAddUI ? "widget-with-ui" : "widget-without-ui";
  const templateDirectory = path.resolve(
    __dirname,
    "..",
    "create-widget",
    "templates",
    templateName
  );
  await fs.copy(templateDirectory, pluginDirectoryPath);
}
```
#### 替换参数
在模板中有些参数我们希望能用用户输入的内容进行替换，比如之前提到的 package.json 中的名字。在模板中我们先用一些特殊的语法写入，就像 `Vue` 的文件中我们使用 `{{ data.name }}`动态地替换括号中的值。在这个脚手架中同样使用了 mustache 语法。脚手架在生成的文件中遍历 (可以去看看 `globby` 的用法) 了所有文件，并对相关内容进行了替换。

```javascript
export async function replaceTemplatizedValues(directory, values) {
  const filePaths = await globby("**/*", {
    cwd: directory,
    dot: true,
  });
  await Promise.all(
    filePaths.map(async function (filePath) {
      const absolutePath = path.join(directory, filePath);
      const buffer = await fs.readFile(absolutePath);
      const fileContents = isUtf8(buffer)
        ? mustache.render(buffer.toString(), values)
        : buffer;
      await fs.outputFile(absolutePath, fileContents);
    })
  );
}
```
我们可以拿他模板中的 package.json 看看替换前的内容是怎样的，我们看到了两个由括号包裹的变量，在替换值的过程中便是将他们替换为目标值了。

```json
{
  "name": "{{packageName}}",
  "version": "1.0.0",
  "description": "{{widgetName}}",
  ...
}
```
#### 依赖安装
这个脚手架中依赖安装实现的部分也是很简单的，采用 `child_process`开启了一个子进程后，执行 `npm install` 指令安装依赖。

```javascript
async function installDependencies(cwd, widgetname, destinationPath) {
  await new (function (resolve, reject) {
    const command = "npm install";
    cp.exec(command, { cwd }, function (error) {
      if (error) {
        reject(error);
        return;
      }
      path.resolve();
    }
  }
}
```

### 最后
到这我们整个流程就结束了，这个模板脚手架的实现已经够 mini 了，此处就不再重新实现了 🤗，欢迎大家评论区交流，我们下期再见吧～
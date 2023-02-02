---
theme: cyanosis
---

### Chalk 简介

> Terminal string styling done right

Chalk 在各类工具包的开发中十分常用，其内部在 [ANSI 转义序列（ANSI escape sequences）](https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97)的基础上封装了很多方法让我们能轻松地去改变控制台输出文本的属性。这篇文章我们先从基本使用入手，然后再一步步了解其内部原理，最后实现一个简易版的 Chalk ～

### 快速上手

Setup，先 `npm install chalk` 一下，接下来通过几个简单的例子来体验一下 Chalk 的功能 😁

```javascript
import chalk from "chalk";

// 通过 console 在控制台查看效果
console.log(chalk.green("Hello"));
console.log(chalk.red.bold("Im"));
console.log(chalk.yellow.bgRed.italic("Dokom"));
```

控制台输出如下所示，我们可以看到 `chalk.green` 对应了绿色文字，`chalk.red.bold` 对应了粗体的红色文字，`chalk.yellow.bgRed.italic` 对应了红底黄字的倾斜文字

![控制台输出1](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/511673f7919a4f8095dbaab50ccdd961~tplv-k3u1fbpfcp-zoom-1.image)

太神奇了～这种效果是怎么来的呢？这时候就要拿出 [ANSI 转义序列（ANSI escape sequences）](https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97)来看看了。

#### 转义序列

ANSI 转义序列（ANSI escape sequences）是一种带内信号的转义序列标准，用于控制视频文本终端上的光标位置、颜色和其他选项。在文本中嵌入确定的字节序列，大部分以 ESC 转义字符和"["字符开始，终端会把这些字节序列解释为相应的指令，而不是普通的字符编码。

在官方的示例中我们了解到转移序列有不同的长度，所有的序列都以 ASCⅡ 字符 `ESC` 开头，第二个字节则是 0x40–0x5F（ASCII @A–Z[\]^\_）范围内的字符。这样看可能有点疑惑，拿个文档中的例子试试

![控制台输出2](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4d01184d180422fb0b3e2e280c685c6~tplv-k3u1fbpfcp-zoom-1.image)

此时我们发现控制终端的颜色由原来的黑底白字反转为了白底黑字，这是什么原理呢。对照官方提供的数据，我们可以发现 7 刚好对应反显，而后面的 `m` 则表示我们此时正在设置 [SGR](https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97#%E9%80%89%E6%8B%A9%E5%9B%BE%E5%BD%A2%E5%86%8D%E7%8E%B0%EF%BC%88SGR%EF%BC%89%E5%8F%82%E6%95%B0) 参数，更多用法大家可以在 Wiki 上进行查看～

#### 源码下载

在开始看源码之前我们先把 [Chalk](https://github.com/chalk/chalk.git) 的代码下载下来或者还是采用之前 `install` 方式都是可以的

```shell
git clone https://github.com/chalk/chalk.git
# or
npm install chalk
```

### 流程分析

> 本文将 Chalk 的仓库克隆到本地，在顶层目录创建 demo.js 文件。

首先我们找到 Chalk 源码中的入口文件，`./source/index.js` ，将其导入我们的 demo.js。然后给执行语句打上断点，进入其中一步步观察。

```javascript
import chalk from "./source/index.js";

const res = chalk.green("Hello World"); // 打上断点
console.log(res);
```

此时单步进入，发现我们在一个对象的 get 函数中，在他的外层包裹了一层 `for of` 循环，我们可以直接得到的是在这循环中我们给 styles 绑定了很多 styleName 属性，并给这些属性绑定了 get 函数。

```javascript
for (const [styleName, style] of Object.entries(ansiStyles)) {
  styles[styleName] = {
    get() {
      const builder = createBuilder(
        this,
        createStyler(style.open, style.close, this[STYLER]),
        this[IS_EMPTY]
      );

      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    },
  };
}
```

这是在干啥呢？项目中找一下这个 styles，其定义部分内容如下，我们发现了很多我们常用的属性比如颜色、加粗、斜体等。此时大概可以想到上面那个循环的作用了：该循环将各个可用的属性绑定到了 styles 上，在我们访问这些方法的时候就会得到一个 builder 对象，结合 Chalk 的使用方法推断这个 builder 对象也是能支持这些 styles 方法的，与此同时 builder 对象还可以进行链式调用。

```javascript
const styles = {
    ...
	modifier: {
		reset: [0, 0],
		bold: [1, 22],
		dim: [2, 22],
		italic: [3, 23],
		underline: [4, 24],
		overline: [53, 55],
		inverse: [7, 27],
		hidden: [8, 28],
		strikethrough: [9, 29],
	},
	color: {
		black: [30, 39],
		red: [31, 39],
		green: [32, 39],
    ...
	},
};
```

点击进入下一步 createStyler 函数，改函数接收了三个参数 `open`，`close`，`parent` ，在之前的代码中，我们给这三个参数分别传入了 style.open 、style.close 、this[STYLER] 。这个函数的作用此时也很明显了，该函数将较后调用的属性合并到了当前的属性上并将整体返回。

```javascript
const createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === undefined) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }

  return {
    open,
    close,
    openAll,
    closeAll,
    parent,
  };
};
```

接下来我们进入 createBuilder 函数，该函数内容也是比较简单的，他在内部创建了 builder 函数。这个函数执行时会调用 applyStyle 函数，这个函数名已经告诉了我们他将样式应用在了字符串上了～

```javascript
const createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) =>
    applyStyle(
      builder,
      arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" ")
    );

  Object.setPrototypeOf(builder, proto);

  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;

  return builder;
};
```

不过我们还是先往下看，其中有一个 `Object.setPrototypeOf` 方法将 proto 设置为 builder 的原型，这个 proto 是啥呢。找到 proto 对象，我们发现他是一个绑定了 styles 和 level 的函数。暂时忽略 level 对象，我们想起 builder 应该是可以链式调用的，看到这里就知道其链式调用的原理了。

```javascript
const proto = Object.defineProperties(() => {}, {
  ...styles,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    },
  },
});
```

我们再回来看看这个 applyStyle 函数（以下代码去除了一些处理逻辑），其主要做的事就是将鸡肉塞进了三明治里面，打开累计的 openAll 和 closeAll，把我们调用时的传入字符串放了进去。到这里，该函数的执行逻辑基本上就结束了。

```javascript
const applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }

  let styler = self[STYLER];

  if (styler === undefined) {
    return string;
  }

  const { openAll, closeAll } = styler;

  return openAll + string + closeAll;
};
```

源码中 chalk 函数的创建过程与 builder 类似，此处不具体分析，本文将在后面的实现环节去说明。

### 简易实现

> Github https://github.com/Dokome/Blog/mini-chalk

首先我们的文件入口需要导出一个 chalk 函数，且可以像之前的 builder 一样进入到 styles 的 get 函数中以达到链式调用的效果。

```javascript
function createChalk() {
  const chalk = (...strings) => strings.join(" ");
  // 将实例的原型指向 craeteChalk
  Object.setPrototypeOf(chalk, createChalk.prototype);
  return chalk;
}

Object.defineProperties(createChalk.prototype, styles);

const chalk = createChalk();
export default chalk;
```

我们也需要对 styles 进行遍历绑定 get 函数，以及声明 createBuilder 、createStyle 等函数，直接在前文列出的函数的基础上做一些修剪就可以了。最后一点就是 styles 对象的获取了，在其源码中除了基本的这些属性样式之外，还有对各类颜色的支持，此处我们只实现最基本版本，大家感兴趣可以看看源码。

```javascript
const styles = {
	modifier: {
		reset: [0, 0],
		bold: [1, 22],
        ...
	},
	color: {
		black: [30, 39],
		red: [31, 39],
        ...
	},
	bgColor: {
		bgBlack: [40, 49],
		bgRed: [41, 49],
        ...
	},
};

function assembleStyles() {
	for (const [_, group] of Object.entries(styles)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`,
			};
		}
	}

	return styles;
}

const ansiStyles = assembleStyles();
export default ansiStyles;

```

到此为止，我们了解了 Chalk 的基本原理并做了一个简版的实现。欢迎大家在评论区交流～

### 参考文档

- https://github.com/chalk/chalk
- https://zh.wikipedia.org/wiki/ANSI%E8%BD%AC%E4%B9%89%E5%BA%8F%E5%88%97

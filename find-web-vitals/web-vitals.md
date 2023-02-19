---
theme: cyanosis
---

性能参数的分析与优化是我们优化项目的时候常常能遇到的问题，大多数时候我们都会使用现成的工具比如 浏览器插件或者一些成熟的前端监控服务。本文将介绍一些概念性的知识以及进入到 [web-vitals](https://github.com/GoogleChrome/web-vitals) 部分源码的阅读。

### 性能指标
性能指标是项目的监控中十分重要的一部分，粗疏需要这些指标对页面性能进行分析进而去做出针对性的改善。在日常开发中，我们打开浏览器控制台的 Performance 面板，常常能看到 FP、FCP、LCP 等参数，但仅这些还是有些欠缺的，我们来看看 Chrome 的 [web.dev](https://web.dev/) 中对这些参数的介绍吧。

#### FCP (First Contentful Paint)
首次渲染有内容的时间点，用户访问 Web 的过程中，在 FCP 之前的时间点是没有任何实际内容的。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7d04144e9b8348fa898e3c0306e41738~tplv-k3u1fbpfcp-zoom-1.image)

在上图中我们可以看到，在 FCP 对应的快照之前页面是空白的，在 FCP 对应的时间点出现了输入框以及 Tab等内容，但此时页面也没有完全渲染，以下是 FCP 的参考值：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/335173da57a743d3b96979c466a63b76~tplv-k3u1fbpfcp-zoom-1.image)

需要注意的是，在页面中嵌套了 iframe 的情况下，无法通过 JavaScript 直接测量。
#### FID (First Input Delay)

测量从用户第一次与页面交互如点击按钮、输入框等，直到浏览器对交互作出响应，实际能够开始处理事件处理程序所经过的时间。

一般来说，发生输入延时是因为主线程还忙于其他任务，暂时不能对用户的输入做出响应，可能导致这种情况发生的一种常见原因是浏览器正忙于解析和执行由应用程序加载的大型 JavaScript 文件。在此过程中，浏览器不能运行任何事件侦听器，因为正在加载的 JavaScript 可能会让浏览器去执行其他工作。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0a9fd281cd7460089649cb2f76f4901~tplv-k3u1fbpfcp-zoom-1.image)

上方的可视化图表中显示的是一个页面，该页面正在发出数个网络请求来获取资源，这些资源下载完毕后，会在主线程上进行处理，这就导致了主线程会处在一个忙碌的状态。

较长的首次输入延迟通常发生在 FCP 和 TTI (Time To Interactive) 之间，因为在此期间，页面已经渲染出部分内容，但交互性还不能保证。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4ea6be29fb5040118035f6ca68dc934e~tplv-k3u1fbpfcp-zoom-1.image)

如上图所示，FCP 和 TTI 之间有相当长的一段时间，如果用户在这段时间内尝试与页面进行交互，那么从浏览器接收到单击直至主线程能够响应之前就会有一段延迟。因为输入发生在浏览器正在运行任务的过程中，所以浏览器必须等到任务完成后才能对输入作出响应。浏览器必须等待的这段时间就是这位用户在该页面上体验到的 FID 。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c1f1a04bcac247e3a6a9aef2aa70c4cc~tplv-k3u1fbpfcp-zoom-1.image)

FID 参考值如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d13c6b1d34474c55b44bc9734dc4458d~tplv-k3u1fbpfcp-zoom-1.image)


#### LCP (Largest Contentful Paint)

最大内容绘制 (LCP) 指标会根据页面首次开始加载的时间点来报告可视区域内可见的最大图像或文本块完成渲染的相对时间。根据 W3C 的规定，LCP 考量的元素为

-   img 元素
-   内嵌在 svg 中的 img 元素
-   video 元素及其使用的封面图像
-   通过 url 加载的带有背景的元素
-   包含文本节点或其他行内级文本元素子元素的块级元素

通常页面是在不断地加载和变化的，所以页面上的最大元素可能在处于变化之中。为了应对这种潜在的变化，浏览器会在绘制第一帧后立即分发一个 `largest-contentful-paint` 类型的 PerformanceEntry，用于识别最大内容元素。但是，在渲染后续帧之后，浏览器会在最大内容元素发生变化时分发另一个 PerformanceEntry 。当用户与页面进行交互时，浏览器将立刻停止报告新条目，因为用户交互通常会改变用户可见的内容。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ab5921b15ac24bafa3865f7370245a37~tplv-k3u1fbpfcp-zoom-1.image)

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/62ac146d30c74675a730d3bf323ddd4c~tplv-k3u1fbpfcp-zoom-1.image)

在上方的两个时间轴中，最大元素随内容加载而变化。在第一个示例中，新内容被添加进 DOM，并因此使最大元素发生了改变。在第二个示例中，由于布局的改变，先前的最大内容从可视区域中被移除。

虽然延迟加载的内容通常比页面上已有的内容更大，但实际情况并非一定如此。接下来的两个示例显示了在页面完全加载之前出现的最大内容绘制。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/59c4927a169c4fabb72f5702f2f39a72~tplv-k3u1fbpfcp-zoom-1.image)  
![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1884b6a9d9264904b89672143169bcf3~tplv-k3u1fbpfcp-zoom-1.image)

在第一个示例中，Instagram 标志加载得相对较早，即使其他内容随后陆续显示，但标志始终是最大元素。在 Google 搜索结果页面示例中，最大元素是一段文本，这段文本在所有图像或标志完成加载之前就显示了出来。由于所有单个图像都小于这段文字，因此这段文字在整个加载过程中始终是最大元素。

LCP 参考值如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b7c0f7ef972942ae96c048d023a81359~tplv-k3u1fbpfcp-zoom-1.image)

#### CLS (Cumulative Layout Shift)

我们在浏览网页时可能会碰到这种情况：在阅读某一段落的文字时，页面上的内容布局突然发生了改变，导致我们找不到之前阅读的位置。甚至我们在点击某些按钮的瞬间，页面发生偏移导致我们点击到了其他的地方......

累积布局偏移 (CLS) 是测量 视觉稳定性 的一个以用户为中心的重要指标，因为该项指标有助于量化用户经历意外布局偏移的频率，较低的 CLS 有助于确保一个页面是令人舒适的。

页面内容的意外移动通常是由于异步加载资源，或者动态添加 DOM 元素到页面现有内容的上方。罪魁祸首可能是未知尺寸的图像或视频、实际渲染后比后备字体更大或更小的字体，或者是动态调整自身大小的第三方广告或小组件。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/11a28c82d3be42b3aef29aa34dad7e23~tplv-k3u1fbpfcp-zoom-1.image)  


CLS 参考值如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/940f307e59bf4fc1a79ed2954bd0c1b6~tplv-k3u1fbpfcp-zoom-1.image)

### Web Vitals
> Essential metrics for a healthy site.

#### 简介
Web Vitals 用于测量真实用户的所有 Web Vitals 指标，以准确匹配 Chrome 测量和报告给其他 Google 工具（例如 Chrome 用户体验报告、页面速度洞察、搜索控制台的速度报告）的方式。
> 这里为了不影响大家的观感，把性能指标的介绍放到最后了。

#### 试一试
在开始了解其原理之前我们来看看它的基本使用方式吧，首先我们初始化一下然后安装这个工具库。
```shell
npm install web-vitals
```
简单地用 html 试一下基本使用
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <div>Hello Dokom</div>
    <script type="module">
      import {
        onFCP,
        onLCP,
      } from "./node_modules/web-vitals/dist/web-vitals.js";

      const logger = (data) => console.log(JSON.stringify(data, null, 2));

      onFCP(logger);
      onLCP(logger);
      
    </script>
  </body>
</html>

```

我们将打印函数作为回调函数传入，就可以直接看到控制台打印指标的内容了，如果我们是开发一个前端监控平台的的话，这里传上报服务端的请求函数也是十分方便的。

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/66cc3a8e582a4f32b9189964d16245a1~tplv-k3u1fbpfcp-watermark.image?)

接下来我们进入 Web Vitals 仓库的源码中学习学习。

#### Performance
> ⚠️ 以下代码粘贴时省略了一些特殊处理逻辑和注释

我们先打开出场率最高的 FCP 指标的代码看看。单从本段代码来看的话，应该是我们此时有一个观察者在 FCP 指标更新后回调了 `handleEntries` ，在成功检测之后通过 `disconnect` 断开了监听。

```typescript
let metric = initMetric('FCP');
let report: ReturnType<typeof bindReporter>;

const handleEntries = (entries: FCPMetric['entries']) => {
  (entries as PerformancePaintTiming[]).forEach((entry) => {
    if (entry.name === 'first-contentful-paint') {
      po!.disconnect();

      if (entry.startTime < visibilityWatcher.firstHiddenTime) {
        metric.value = Math.max(entry.startTime - getActivationStart(), 0);
        metric.entries.push(entry);
        report(true);
      }
    }
  });
};

const po = observe('paint', handleEntries);
```
没接触过相关的同学可能会比较懵逼，我们可以在 [MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/PerformancePaintTiming) 上看看这些参数分别代表了什么意义。首先是 `PerformancePaintTiming`，MDN 的说明中这个类型是 `PerformanceEntry` 的拓展。那么问题来了，`PerformanceEntry` 又是个啥。

> PerformanceEntry 对象代表了 performance 时间列表中的单个 metric 数据。每一个 performance entry 都可以在应用运行过程中通过手动构建 mark (en-US) 或者 measure (en-US) (例如调用 mark() 方法) 生成。此外，Performance entries 在资源加载的时候，也会被动生成（例如图片、script、css 等资源加载）

`PerformanceEntry` 中存储了在页面加载和执行的过程中的性能指标参数，这些参数有的是对象本身记录的，也可以是我们手动通过去打起始点和结束点去定义的。在上面的 `handleEntries` 中我们拿到了这个 Entries 数组，在其中找到 FCP 对应的一项触发其相关操作。

了解了这个过程后，我们再看到代码片段的最后一行，这个 observe 又是哪来的呢？我们点进这个函数观察一波，发现它实际上是用到了 `PerformanceObserve` 对象，对这个监听的过程做了一个封装。

```javascript
export const observe = <K extends keyof PerformanceEntryMap>(
    ...
  ): PerformanceObserver => {
    try {
      if (PerformanceObserver.supportedEntryTypes.includes(type)) {
        const po = new PerformanceObserver((list) => {
          Promise.resolve().then(() => {
            callback(list.getEntries() as PerformanceEntryMap[K]);
          });
        });
        po.observe(
          Object.assign(
            {
              type,
              buffered: true,
            },
            opts || {}
          ) as PerformanceObserverInit
        );
        return po;
    ...
  };
```
这样一来这个指标获取的过程我们就了解了，首先是拿到了一个 PerformanceObserver 的示例，对性能指标的改变进行监听，改变后触发回调函数，上传到我们的存储中去。在 web-vitals 中很多指标的检测都是基于类似的方式实现的 ～ (计算方式在最后一部分有描述)

#### FirstHiddenTime
大家在上面的代码中可能还注意到了 `firstHiddenTime`，它用来存储页面首次隐藏的时间，为什么要计算这个首次隐藏的时间呢，我们来看看 web.dev 中的解释

> API 会为在后台选项卡中加载的页面分发 `first-contentful-paint` 条目，但在计算 FCP 时应忽略这些页面（只有当页面始终处于前台时才应考虑首次绘制的时机）。

除了 FCP 以外，其他指标如 FID 和 LCP 都用到了这个值，作用也是类似的，实现的原理可以具体看看[`getVisibilityWatcher.ts`](https://github.com/GoogleChrome/web-vitals/blob/9f11c4c6578fb4c5ee6fa4e32b9d1d756475f135/src/lib/getVisibilityWatcher.ts#L50)。

### 最后
到这我们整篇文章就结束了，大家可以自己也动手试一试 🤗，不足之处欢迎评论区交流，我们下期再见～


### 参考文档
- <https://web.dev>


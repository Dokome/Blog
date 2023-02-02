import ansiStyles from "./myStyles.js";

const styles = Object.create(null);

const GENERATOR = Symbol("GENERATOR");
const STYLER = Symbol("STYLER");

const applyStyle = (self, string) => {
	const styler = self[STYLER];
	return styler.openAll + string + styler.closeAll;
};

// 创建样式
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

// [类名，样式的 asci 值]
for (const [styleName, style] of Object.entries(ansiStyles)) {
	//
	styles[styleName] = {
		get() {
			const builder = (...arguments_) =>
				applyStyle(builder, arguments_.join(" "));

			Object.setPrototypeOf(builder, createChalk.prototype);
			builder[GENERATOR] = this;
			builder[STYLER] = createStyler(style.open, style.close, this[STYLER]);

			// 将 builder 挂在当前的属性下 并返回 builder
			Object.defineProperty(this, styleName, { value: builder });
			return builder;
		},
	};
}

function createChalk() {
	const chalk = (...strings) => strings.join(" ");
	// 将实例的原型指向 craeteChalk
	Object.setPrototypeOf(chalk, createChalk.prototype);
	return chalk;
}

Object.defineProperties(createChalk.prototype, styles);

const chalk = createChalk();
export default chalk;

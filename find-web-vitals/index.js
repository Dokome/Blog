let firstHiddenTime = -1;

const initHiddenTime = () => {
  return document.visibilityState === "hidden" && !document.prerendering
    ? 0
    : Infinity;
};

const onVisibilityUpdate = (event: Event) => {
  if (document.visibilityState === "hidden" && firstHiddenTime > -1) {
    firstHiddenTime = event.type === "visibilitychange" ? event.timeStamp : 0;
    removeChangeListeners();
  }
};

const addChangeListeners = () => {
  addEventListener("visibilitychange", onVisibilityUpdate, true);
};

const removeChangeListeners = () => {
  removeEventListener("visibilitychange", onVisibilityUpdate, true);
};

export const getVisibilityWatcher = () => {
  if (firstHiddenTime < 0) {
      firstHiddenTime = initHiddenTime();
      addChangeListeners();
  }
  return {
    get firstHiddenTime() {
      return firstHiddenTime;
    },
  };
};

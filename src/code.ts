figma.showUI(__html__, { themeColors: true, height: 300 });

function later(delay) {
  return new Promise(function (resolve) {
    setTimeout(resolve, delay);
  });
}

let iconInstances: InstanceNode[] = [];
let mono;

const checkFigmaSelection = () => {
  const figmaSelection = figma.currentPage.selection[0];
  if (
    figma.currentPage.selection.length === 1 &&
    figmaSelection &&
    figmaSelection.type === "INSTANCE" &&
    figmaSelection.mainComponent.name === "Mono=True"
  ) {
    mono = figma.currentPage.selection[0] as InstanceNode;
    figma.ui.postMessage({
      type: "enable",
      value: true,
    });
  } else {
    figma.ui.postMessage({
      type: "enable",
      value: false,
    });
  }
};
figma.on("selectionchange", () => {
  checkFigmaSelection();
});

const doInstanceSelection = () => {
  let items: InstanceNode[] = [];
  // find icons
  const instances = figma.currentPage.findAllWithCriteria({
    types: ["INSTANCE"],
  });

  items = instances.filter((i) => {
    try {
      if (!i.componentProperties) {
        return false;
      }
      return (
        Object.keys(i.componentProperties).length === 3 &&
        i.parent.type !== "BOOLEAN_OPERATION" &&
        i.mainComponent.name !== "Mono=True" &&
        i.componentProperties.Size &&
        i.componentProperties.Stroke &&
        i.componentProperties.Style
      );
    } catch (e) {
      return false;
    }
  });
  return items;
};

figma.on("run", (event) => {
  checkFigmaSelection();
});

figma.ui.onmessage = async (msg) => {
  let failedIcons: SceneNode[] = [];

  if (msg.type === "scan") {
    iconInstances = doInstanceSelection();
    figma.ui.postMessage({
      type: "selection",
      value: iconInstances.length,
    });
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
  }

  if (msg.type === "optimize") {
    let count = 0;
    failedIcons = [];

    // store original props
    const iconInstanceProps: {
      [x: string]: string;
    }[] = [];
    const iconComponents: ComponentNode[] = [];
    const itemFills = [];
    const vectorVisibility: boolean[] = [];
    const fillStyleIds: (string | typeof figma.mixed)[] = [];
    const strokStyleIds: string[] = [];

    iconInstances.forEach((instance) => {
      iconComponents.push(instance.mainComponent);
      iconInstanceProps.push({
        ...instance.variantProperties,
      });
      itemFills.push(
        JSON.parse(JSON.stringify((instance.children[0] as VectorNode).fills))
      );
      vectorVisibility.push((instance.children[0] as VectorNode).visible);
      fillStyleIds.push((instance.children[0] as VectorNode).fillStyleId);
      strokStyleIds.push((instance.children[0] as VectorNode).strokeStyleId);
    });

    let iterator = 0;
    for (const instance of iconInstances) {
      // try {
      // store instance size
      const width = instance.width;
      const height = instance.height;

      // store the icon main component
      const iconComponent = iconComponents[iterator];

      // store the icon instance props
      const iconProps = iconInstanceProps[iterator];

      // store the fills of the icon vector
      const fills = itemFills[iterator];

      // store vector visibility
      const vectorVisible = vectorVisibility[iterator];

      const fillStyleId = fillStyleIds[iterator];
      const strokeStyleId = strokStyleIds[iterator];

      // swap the icon with an instance of the mono icon.
      try {
        if (instance.mainComponent.name !== "Mono=True") {
          instance.swapComponent(mono.mainComponent);
        }
      } catch (error) {
        failedIcons.push(instance);
      }
      instance.resize(width, height);

      // grab the icon instance within the mono icon.
      const childrenIcon = (instance.children[0] as BooleanOperationNode)
        .children[0] as InstanceNode;

      // swap the icon in the new with the initial icon.
      try {
        childrenIcon.swapComponent(iconComponent);
      } catch (error) {
        failedIcons.push(instance);
      }

      // add the original fills to the mono icon
      const union = instance.children[0] as BooleanOperationNode;

      if (strokeStyleId) {
        union.strokeStyleId = strokeStyleId;
      } else if (fillStyleId) {
        union.fillStyleId = fillStyleId;
      } else {
        union.fills = fills;
      }

      if (vectorVisible === false) {
        union.visible = false;
      }

      (union.children[0] as InstanceNode).setProperties(iconProps);

      count += 1;

      figma.ui.postMessage({
        type: "optimized",
        value: count,
      });

      iterator++;
      await later(10);
    }

    iconInstances = doInstanceSelection();
    figma.ui.postMessage({
      type: "selection",
      value: iconInstances.length,
    });
    figma.ui.postMessage({
      type: "failed",
      value: failedIcons.map((i) => (i as InstanceNode).mainComponent?.name),
    });
  }

  if (msg.type === "selectError") {
    const index = Number(msg.value);
    const itemFailed = failedIcons[index];
    figma.currentPage.selection = [itemFailed];
    figma.viewport.scrollAndZoomIntoView([itemFailed]);
  }
};

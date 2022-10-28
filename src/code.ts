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
    for (const instance of iconInstances) {
      try {
        // store instance size
        const width = instance.width;
        const height = instance.height;

        // store the icon main component
        const iconComponent = instance.mainComponent;

        // store the icon instance props
        const iconProps = { ...instance.variantProperties };
        // store the fills of the icon vector
        const fills = JSON.parse(
          JSON.stringify((instance.children[0] as VectorNode).fills)
        );

        // store vector visibility
        const vectorVisible = (instance.children[0] as VectorNode).visible;

        const fillStyleId = (instance.children[0] as VectorNode).fillStyleId;
        const strokeStyleId = (instance.children[0] as VectorNode)
          .strokeStyleId;

        // swap the icon with an instance of the mono icon.
        if (instance.mainComponent.name !== "Mono=True") {
          instance.swapComponent(mono.mainComponent);
        }
        instance.resize(width, height);

        // grab the icon instance within the mono icon.
        const childrenIcon = (instance.children[0] as BooleanOperationNode)
          .children[0] as InstanceNode;

        // swap the icon in the new with the initial icon.
        childrenIcon.swapComponent(iconComponent);

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
      } catch (error) {
        // do not include the error if the swap was done already
        if (!error.message.includes("swapComponent")) {
          failedIcons.push(instance);
        }
      }
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

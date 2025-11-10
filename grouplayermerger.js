/**
 * Merges layers across multiple groups at specific indices.
 * Prompts user for the result group name and combines corresponding layers from each group.
 */
async function mergeGroupLayers() {
    const dialog = document.getElementById("groupNameDialog");
    const groupNameInput = document.getElementById("groupName");

    dialog.showModal();

    return new Promise((resolve) => {
        const submitBtn = document.getElementById("btnSubmitGroupName");
        const cancelBtn = document.getElementById("btnCancelGroupName");

        const handleSubmit = async () => {
            const groupName = groupNameInput.value.trim();

            if (!groupName) {
                console.log("Group name cannot be empty");
                return;
            }

            dialog.close();

            await performGroupLayerMerge(groupName);

            groupNameInput.value = "";

            cleanup();
            resolve();
        };

        const handleCancel = () => {
            dialog.close();

            groupNameInput.value = "";

            cleanup();
            resolve();
        };

        const cleanup = () => {
            submitBtn.removeEventListener("click", handleSubmit);
            cancelBtn.removeEventListener("click", handleCancel);
        };

        submitBtn.addEventListener("click", handleSubmit);
        cancelBtn.addEventListener("click", handleCancel);
    });
}

/**
 * Performs the actual group layer merge operation.
 * @param {string} resultGroupName - Name for the merged result group
 */
async function performGroupLayerMerge(resultGroupName) {
    const { app, core } = require('photoshop');
    const utils = new Utilities(app, core);
    const document = app.activeDocument;
    const batchPlay = require("photoshop").action.batchPlay;

    async function modal(executionContext) {
        const selection = document.activeLayers;

        if (selection.length === 0) {
            console.log("No layers selected");
            return;
        }

        // Helper function to check if a layer is a descendant of another layer
        function isDescendantOf(layer, potentialAncestor) {
            let current = layer.parent;
            while (current) {
                if (current.id === potentialAncestor.id) {
                    return true;
                }
                current = current.parent;
            }
            return false;
        }

        const parentLayers = [];
        for (let i = 0; i < selection.length; i++) {
            let isNested = false;
            for (let j = 0; j < selection.length; j++) {
                if (i !== j && isDescendantOf(selection[i], selection[j])) {
                    isNested = true;
                    break;
                }
            }
            if (!isNested) {
                parentLayers.push(selection[i]);
            }
        }

        console.log(`Found ${parentLayers.length} parent-level layers out of ${selection.length} selected layers`);

        if (parentLayers.length < 2) {
            console.log("Please select at least 2 groups to merge");
            return;
        }

        // Verify all parent layers are groups
        for (let i = 0; i < parentLayers.length; i++) {
            if (!parentLayers[i].layers || parentLayers[i].layers.length === 0) {
                console.log(`Selected layer "${parentLayers[i].name}" is not a group`);
                return;
            }
        }

        // Sort parent layers by their position in document.layers (top to bottom)
        // Lower index in document.layers = higher in stack (visually on top)
        parentLayers.sort((a, b) => {
            const indexA = document.layers.findIndex(l => l.id === a.id);
            const indexB = document.layers.findIndex(l => l.id === b.id);
            return indexA - indexB; // Lower index = on top
        });

        console.log("Sorted groups by stacking order (top to bottom):", parentLayers.map(l => l.name).join(", "));

        // Get layer count from first group
        const layerCount = parentLayers[0].layers.length;

        // Verify all groups have the same number of layers
        for (let i = 1; i < parentLayers.length; i++) {
            if (parentLayers[i].layers.length !== layerCount) {
                console.log(`Error: Group "${parentLayers[i].name}" has ${parentLayers[i].layers.length} layers, but expected ${layerCount} layers`);
                return;
            }
        }

        // Verify that child layers are not groups
        for (let i = 0; i < parentLayers.length; i++) {
            for (let j = 0; j < parentLayers[i].layers.length; j++) {
                const childLayer = parentLayers[i].layers[j];
                if (childLayer.layers && childLayer.layers.length > 0) {
                    console.log(`Error: Layer "${childLayer.name}" in group "${parentLayers[i].name}" is a group. Only non-group layers are supported`);
                    return;
                }
            }
        }

        console.log(`Merging ${parentLayers.length} groups with ${layerCount} layers each`);

        const resultGroup = await document.createLayerGroup({ name: resultGroupName });

        for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
            console.log(`Processing layer index ${layerIndex}...`);

            const layersToMerge = [];
            for (let groupIndex = 0; groupIndex < parentLayers.length; groupIndex++) {
                layersToMerge.push(parentLayers[groupIndex].layers[layerIndex]);
            }

            console.log(`  Merging layers (top to bottom): ${layersToMerge.map(l => `${l.name} (from ${l.parent.name})`).join(', ')}`);

            const duplicatedLayers = [];
            for (let i = 0; i < layersToMerge.length; i++) {
                const duplicated = await layersToMerge[i].duplicate(resultGroup);
                duplicated.visible = true;
                duplicatedLayers.push(duplicated);
            }

            console.log(`  Duplicated ${duplicatedLayers.length} layers`);

            // Now reorder them explicitly: bottom layer should be at bottom, top layer at top
            // In Photoshop, index 0 in layers array = top of stack
            // We want: duplicatedLayers[0] (from top group) to be at top
            // Move each layer to establish correct order from top to bottom
            for (let i = 1; i < duplicatedLayers.length; i++) {
                // Move this layer to be after the previous layer (below it)
                await duplicatedLayers[i].move(duplicatedLayers[i-1], "placeAfter");
            }

            console.log(`  Reordered layers for correct stacking`);

            // Select all duplicated layers for merging
            const layerRefs = duplicatedLayers.map(layer => ({ _ref: "layer", _id: layer.id }));

            await batchPlay([
                {
                    _obj: "select",
                    _target: layerRefs,
                    makeVisible: false
                }
            ], {});

            console.log(`  Selected ${duplicatedLayers.length} layers for merge`);

            await batchPlay([
                {
                    _obj: "mergeLayersNew"
                }
            ], {});

            console.log(`  Merge completed`);

            const activeLayers = document.activeLayers;
            if (activeLayers.length > 0) {
                const mergedLayer = activeLayers[0];
                const mergedLayerName = `${resultGroupName}_${layerIndex}`;
                mergedLayer.name = mergedLayerName;

                await mergedLayer.move(resultGroup, "placeInside");
            }

            const groupLayers = resultGroup.layers;
            for (let i = groupLayers.length - 1; i >= 0; i--) {
                const layer = groupLayers[i];
                if (layer.name.includes(" copy") || !layer.name.startsWith(resultGroupName)) {
                    await layer.delete();
                }
            }

            for (let i = document.layers.length - 1; i >= 0; i--) {
                const layer = document.layers[i];
                if (layer.name.includes(" copy")) {
                    await layer.delete();
                }
            }
        }

        console.log("Cleaning up original groups...");
        for (let i = 0; i < parentLayers.length; i++) {
            const group = parentLayers[i];
            // Delete layers from end to start to avoid index shifting issues
            while (group.layers && group.layers.length > 0) {
                await group.layers[group.layers.length - 1].delete();
            }
        }
        for (let i = 0; i < parentLayers.length; i++) {
            await parentLayers[i].delete();
        }

        console.log("Group layer merge completed successfully");
    }

    await utils.executeInModalScope(modal, "Merging Group Layers");
}

/**
 * Reverses the order of layers within a selected group.
 */
async function reverseLayerOrder() {
    const { app, core } = require('photoshop');
    const utils = new Utilities(app, core);
    const document = app.activeDocument;

    async function modal(executionContext) {
        const selection = document.activeLayers;

        if (selection.length === 0) {
            console.log("No layer selected");
            return;
        }

        const selectedLayer = selection[0];

        if (!selectedLayer.layers || selectedLayer.layers.length === 0) {
            console.log("Selected layer is not a group");
            return;
        }

        console.log(`Reversing layer order for group: ${selectedLayer.name}`);
        await utils.reverseLayerOrder(selectedLayer);
        console.log("Layer order reversed successfully");
    }

    await utils.executeInModalScope(modal, "Reversing Layer Order");
}

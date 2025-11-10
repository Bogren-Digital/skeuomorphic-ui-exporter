/**
 * Sets the position of selected layers to specified coordinates.
 * Prompts user for X and Y coordinates via a dialog.
 */
async function setLayerPosition() {
    const dialog = document.getElementById("positionDialog");
    const xInput = document.getElementById("xPosition");
    const yInput = document.getElementById("yPosition");

    dialog.showModal();

    return new Promise((resolve) => {
        const submitBtn = document.getElementById("btnSubmitPosition");
        const cancelBtn = document.getElementById("btnCancelPosition");

        const handleSubmit = async () => {
            const x = parseFloat(xInput.value) || 0;
            const y = parseFloat(yInput.value) || 0;

            dialog.close();

            await applyPositionToSelectedLayers(x, y);

            xInput.value = "";
            yInput.value = "";

            cleanup();
            resolve();
        };

        const handleCancel = () => {
            dialog.close();

            xInput.value = "";
            yInput.value = "";

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
 * Applies the specified position to all selected layers.
 * @param {number} x - Target X coordinate
 * @param {number} y - Target Y coordinate
 */
async function applyPositionToSelectedLayers(x, y) {
    const { app, core } = require("photoshop");

    async function setPosition(executionContext) {
        const doc = app.activeDocument;
        const selectedLayers = doc.activeLayers;

        if (selectedLayers.length === 0) {
            console.log("No layers selected");
            return;
        }

        for (const layer of selectedLayers) {
            await layer.translate(x - layer.bounds.left, y - layer.bounds.top);
        }

        console.log(`Set position to (${x}, ${y}) for ${selectedLayers.length} layer(s)`);
    }

    try {
        await core.executeAsModal(setPosition, {
            commandName: "Set Layer Position"
        });
    } catch (error) {
        console.error("Error setting layer position:", error);
    }
}

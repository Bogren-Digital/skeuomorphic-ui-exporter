/**
 * Utility class providing helper methods for Photoshop plugin operations.
 * Handles modal execution contexts, layer management, and file operations.
 */
class Utilities {
    constructor(app, core) {
        this.app = app;
        this.core = core;
    }

//#region Execution Context
    /**
     * Executes a function in Photoshop's modal scope.
     * Modal scope is required for most document modifications.
     * @param {Function} fn - The function to execute
     * @param {string} commandName - Name displayed in Photoshop's UI
     */
    async executeInModalScope(fn, commandName) {
        try {
            await this.core.executeAsModal(fn, {
                commandName: commandName
            });
        } catch (error) {
            console.error("Error executing in modal scope:", error);
        }
    }

    /**
     * Executes a function in modal scope on a duplicate document.
     * The duplicate is automatically closed after execution.
     * @param {Function} fn - The function to execute
     * @param {string} commandName - Name displayed in Photoshop's UI
     */
    async executeModalInDuplicateDocument(fn, commandName) {
        console.log(commandName);
        
        const self = this;
        
        async function duplicateDocumentAndRunModalFunction(executionContext) {
            try {
                let hostControl = executionContext.hostControl;
                let workingDocument = await self.app.activeDocument.duplicate();
                await hostControl.registerAutoCloseDocument(workingDocument.id);
                
                await self.executeInModalScope(fn, commandName);
            } catch (error) {
                console.error("Error in modal execution:", error);
                throw error;
            }
        }

        await this.executeInModalScope(duplicateDocumentAndRunModalFunction, commandName);
    }
//#endregion

//#region Layer Management

    /**
     * Finds a layer by its unique ID in the layer hierarchy.
     * @param {Array} layers - Array of layers to search
     * @param {number} id - Layer ID to find
     * @returns {Object|null} The found layer or null
     */
    findLayerById(layers, id) {
        for (let i = 0; i < layers.length; i++) {
            if(layers[i].id === id)
                return layers[i];

            if (layers[i].layers && layers[i].layers.length > 0) {
                const result = this.findLayerById(layers[i].layers, id);
                if(result != null)
                    return result;
            }
        }

        return null;
    }

    /**
     * Finds a layer by name in the layer hierarchy.
     * @param {Array} layers - Array of layers to search
     * @param {string} name - Layer name to find
     * @returns {Object|null} The found layer or null
     */
    findLayerByName(layers, name) {
        for (let i = 0; i < layers.length; i++) {
            if(layers[i].name === name) {
                return layers[i];
            }

            if (layers[i].layers && layers[i].layers.length > 0) {
                const result = this.findLayerByName(layers[i].layers, name);
                if(result != null)
                    return result;
            }
        }

        return null;
    }

    /**
     * Toggles visibility of layers and their children recursively.
     * @param {Array} layers - Array of layers to toggle
     * @param {boolean} isVisible - Target visibility state
     */
    async toggleLayerVisibilityRecursively(layers, isVisible) {
        for (let i = 0; i < layers.length; i++) {
            layers[i].visible = isVisible;
            if (layers[i].layers && layers[i].layers.length > 0) {
                await this.toggleLayerVisibilityRecursively(layers[i].layers, isVisible);
            }
        }
    }

    /**
     * Toggles visibility of a layer and all its parent layers.
     * This ensures all parent groups are visible when showing a child layer.
     * @param {Object} layer - Layer to toggle
     * @param {boolean} isVisible - Target visibility state
     */
    async toggleLayerVisibilityRecursivelyUpwards(layer, isVisible) {
        layer.visible = isVisible;
        const parent = layer.parent;
        if (parent) {
            await this.toggleLayerVisibilityRecursivelyUpwards(parent, isVisible);
        }
    }

    /**
     * Hides all layers in a document.
     * @param {Object} document - The Photoshop document
     */
    async hideAllLayers(document) {
        const self = this;

        async function modal(executionContext) {
            await self.toggleLayerVisibilityRecursively(document.layers, false);
        }

        await this.executeInModalScope(modal, "Hiding all layers");
    }

    /**
     * Gets all group layers from a layer array.
     * @param {Array} layers - Array of layers to filter
     * @returns {Array} Array of group layers
     */
    getGroups(layers) {
        const groups = [];
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].layers && layers[i].layers.length > 0) {
                groups.push(layers[i]);
            }
        }
        return groups;
    }

    /**
     * Reverses the order of layers within a group.
     * @param {Object} group - The group layer to reverse
     */
    async reverseLayerOrder(group) {
        const layerRefs = [];
        for (let i = 0; i < group.layers.length; i++) {
            layerRefs.push(group.layers[i]);
        }

        for (let i = layerRefs.length - 1; i >= 1; i--) {
            await layerRefs[i].move(layerRefs[0], "placeBefore");
        }
    }
//#endregion

//#region File Management
    /**
     * Gets an existing folder or creates it if it doesn't exist.
     * @param {Object} parentFolder - The parent folder
     * @param {string} folderName - Name of the folder to get or create
     * @returns {Object} The folder object
     */
    async getOrCreateFolder(parentFolder, folderName) {
        try {
            const existingFolder = await parentFolder.getEntry(folderName);
            
            if (existingFolder && existingFolder.isFolder) {
                return existingFolder;
            }
        } catch (err) {
            // Folder doesn't exist, which is fine - we'll create it below
        }
        
        return await parentFolder.createFolder(folderName);
    }
//#endregion
}
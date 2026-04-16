/**
 * Generates an XML metadata file containing information about all export objects.
 */
async function generateMetadata() {
    const { app, core } = require('photoshop');
    const exportFolder = await getExportFolder();
    const utils = new Utilities(app, core);
    const document = app.activeDocument;

    async function modal(executionContext) {
        const exportObjects = getAllExportObjects(document, utils);
        console.log("Export objects:", exportObjects);

        const width = document.width;
        const height = document.height;

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += `<metadata width="${width}" height="${height}">\n`;
        for (const exportObject of exportObjects) {
            const progress = (exportObjects.indexOf(exportObject) + 1.0) / exportObjects.length;
            executionContext.reportProgress({value: progress, commandName: `Generating metadata for ${exportObject.getName()}`});
            xml += `  ${exportObject.getMetadata()}\n`;
        }
        xml += '</metadata>';

        const metadataFile = await exportFolder.createFile("metadata.xml", { overwrite: true });
        await metadataFile.write(xml);
        console.log("Metadata file created:", metadataFile.nativePath);
        console.log("Metadata XML:", xml);
    }

    await utils.executeInModalScope(modal, "Generating Metadata");
}

/**
 * Generates an XML metadata file with 1x/2x file path attributes.
 * Uses the same 300 PPI coordinate space for layout.
 * Adds file2x / fileNameSuffix2x attributes for retina asset variants.
 */
async function generateMetadata1x2x() {
    const { app, core } = require('photoshop');
    const exportFolder = await getExportFolder();
    const utils = new Utilities(app, core);
    const document = app.activeDocument;

    async function modal(executionContext) {
        const exportObjects = getAllExportObjects(document, utils);
        console.log("Export objects (1x/2x metadata):", exportObjects);

        const width = document.width;
        const height = document.height;

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += `<metadata width="${width}" height="${height}">\n`;
        for (const exportObject of exportObjects) {
            const progress = (exportObjects.indexOf(exportObject) + 1.0) / exportObjects.length;
            executionContext.reportProgress({value: progress, commandName: `Generating 1x/2x metadata for ${exportObject.getName()}`});
            xml += `  ${exportObject.getMetadata1x2x()}\n`;
        }
        xml += '</metadata>';

        const metadataFile = await exportFolder.createFile("metadata.xml", { overwrite: true });
        await metadataFile.write(xml);
        console.log("1x/2x Metadata file created:", metadataFile.nativePath);
        console.log("1x/2x Metadata XML:", xml);
    }

    await utils.executeInModalScope(modal, "Generating 1x/2x Metadata");
}
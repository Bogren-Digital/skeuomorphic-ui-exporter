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
/**
 * Event listeners for plugin UI elements.
 */

document.getElementById("btnExport").addEventListener("click", exportAll);
document.getElementById("btnMetadata").addEventListener("click", generateMetadata);
document.getElementById("btnSetPosition").addEventListener("click", setLayerPosition);
document.getElementById("btnReverseLayerOrder").addEventListener("click", reverseLayerOrder);
document.getElementById("btnMergeGroupLayers").addEventListener("click", mergeGroupLayers);

const exportModeGroup = document.getElementById("exportModeGroup");
if (exportModeGroup) {
    exportModeGroup.selected = "transparent";
    setExportMode("transparent");

    exportModeGroup.addEventListener("change", (event) => {
        const selectedMode = event.target.selected;
        setExportMode(selectedMode);
        console.log("Export mode changed to:", selectedMode);
    });
}

document.querySelectorAll('.section summary').forEach(summary => {
    summary.addEventListener('click', (e) => {
        const details = e.target.closest('.section');
        if (details) {
            if (details.hasAttribute('open')) {
                details.removeAttribute('open');
            } else {
                details.setAttribute('open', '');
            }
        }
    });
});
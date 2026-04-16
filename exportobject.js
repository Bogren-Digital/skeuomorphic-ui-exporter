/**
 * Builds a hierarchical name by traversing parent groups.
 * Format: "ChildName ParentName" (reversed hierarchy with spaces)
 * @param {Object} layer - The layer to build name for
 * @returns {string} The hierarchical name
 */
function buildHierarchicalName(layer) {
  const names = [];
  let current = layer;

  while (current && current.name) {
    names.push(current.name);
    current = current.parent;
  }

  return names.join(' ');
}

/**
 * Base class for export objects representing layers or groups to be exported.
 * Provides common functionality for getting layer info, bounds, and export paths.
 */
class ExportObject {
  constructor(document, utils) {
    this.document = document;
    this.utils = utils;
  }
  
  /**
   * Gets the layer associated with this export object.
   * Must be implemented by derived classes.
   * @param {Object} document - The Photoshop document
   * @returns {Object} The layer object
   */
  getLayer() {
    throw new Error("getLayer method not implemented");
  }

  /**
   * Gets the metadata XML representation for this export object.
   * Must be implemented by derived classes.
   * @returns {string} XML metadata string
   */
  getMetadata() {
    throw new Error("getMetadata method not implemented");
  }

  /**
   * Gets the bounding box of the layer.
   * @param {Object} document - The Photoshop document
   * @returns {Object} Bounds object with left, top, right, bottom properties
   */
  getBounds(document = this.document) {
    const layer = this.getLayer(document);
    return {
        left: layer.bounds.left,
        top: layer.bounds.top,
        right: layer.bounds.right,
        bottom: layer.bounds.bottom
    };
  }

  /**
   * Gets the parent layer of this export object's layer.
   * @returns {Object|null} The parent layer
   */
  getParent() {
    return this.getLayer().parent;
  }

  /**
   * Gets the file name suffix for exported files.
   * @returns {string} The file suffix
   */
  getFileNameSuffix() {
    return `.png`;
  }

  /**
   * Gets the name of this export object.
   * @returns {string} The name
   */
  getName() {
    return this.getLayer().name;
  }

  /**
   * Gets the sanitized export file name.
   * @returns {string} The file name
   */
  getExportFileName() {
    const fileName = this.getName().replace(/[^a-zA-Z0-9]/g, "_");
    return `${fileName}${this.getFileNameSuffix()}`;
  }

  /**
   * Gets the file name suffix for 2x exported files.
   * @returns {string} The 2x file suffix
   */
  getFileNameSuffix2x() {
    return `@2x.png`;
  }

  /**
   * Gets the sanitized 2x export file name.
   * @returns {string} The 2x file name
   */
  getExportFileName2x() {
    const fileName = this.getName().replace(/[^a-zA-Z0-9]/g, "_");
    return `${fileName}@2x${this.getFileNameSuffix()}`;
  }

  /**
   * Gets the export directory for this object.
   * Creates a subfolder based on parent name if applicable.
   * @returns {Object} The folder object
   */
  async getExportDirectory() {
    const parent = this.getParent();
    const parentName = parent ? parent.name : null;
    const exportFolder = await getExportFolder();
    return parentName ? this.utils.getOrCreateFolder(exportFolder, parentName) : exportFolder;
  }
}

/**
 * Export object for a single layer with a specific name.
 */
class LayerExportObject extends ExportObject {
  constructor(document, utils, layerName) {
    super(document, utils);
    this.layerName = layerName;
  }
  
  getLayer(document = this.document) {
    return this.utils.findLayerByName(document.layers, this.layerName);
  }

  getMetadata() {
    return `<IMAGE name="${this.getName()}" file="${this.getExportFileName()}" x="${this.getBounds().left}" y="${this.getBounds().top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" imageType="raster" />`;
  }

  getMetadata1x2x() {
    return `<IMAGE name="${this.getName()}" file="${this.getExportFileName()}" file2x="${this.getExportFileName2x()}" x="${this.getBounds().left}" y="${this.getBounds().top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" imageType="raster" />`;
  }
}

/**
 * Export object for the first frame of a group.
 * Used when only the first frame of an animation/group needs to be exported.
 */
class FirstFrameExportObject extends ExportObject {
    constructor(document, utils, groupName) {
      super(document, utils);
      this.groupName = groupName;
    }
    
    getLayer(document = this.document) {
        const group = this.utils.findLayerByName(document.layers, this.groupName);
        return group ? group.layers[0] : null;
    }

    getParent() {
        const group = this.utils.findLayerByName(this.document.layers, this.groupName);
        return group ? group.parent : null;
    }
    
    getName() {
      return this.groupName;
    }

    getMetadata() {
      return `<IMAGE name="${this.getName()}" file="${this.getExportFileName()}" x="${this.getBounds().left}" y="${this.getBounds().top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" imageType="raster" />`;
    }

    getMetadata1x2x() {
      return `<IMAGE name="${this.getName()}" file="${this.getExportFileName()}" file2x="${this.getExportFileName2x()}" x="${this.getBounds().left}" y="${this.getBounds().top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" imageType="raster" />`;
    }
}

/**
 * Export object for tweenable animations.
 * Exports first frame but uses first and last frame positions for animation bounds.
 */
class TweenableExportObject extends FirstFrameExportObject {
  constructor(document, utils, groupName) {
    super(document, utils);
    this.groupName = groupName;
  }

  getLastFrame() {
    const group = this.utils.findLayerByName(this.document.layers, this.groupName);
    return group ? group.layers[group.layers.length - 1] : null;
  }

  getMetadata() {
    return `<TWEENABLE name="${this.getName()}" file="${this.getExportFileName()}" minX="${this.getBounds().left}" minY="${this.getBounds().top}" maxX="${this.getLastFrame().bounds.left}" maxY="${this.getLastFrame().bounds.top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" imageType="raster" />`;
  }

  getMetadata1x2x() {
    return `<TWEENABLE name="${this.getName()}" file="${this.getExportFileName()}" file2x="${this.getExportFileName2x()}" minX="${this.getBounds().left}" minY="${this.getBounds().top}" maxX="${this.getLastFrame().bounds.left}" maxY="${this.getLastFrame().bounds.top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" imageType="raster" />`;
  }
}

/**
 * Export object for all frames of a group.
 * Exports each layer in the group as a separate frame.
 */
class GroupExportObject extends ExportObject {
  constructor(document, utils, group) {
    super(document, utils);
    this.group = group;
    this.groupName = buildHierarchicalName(group);
    this.type = group.parent ? group.parent.name.toUpperCase() : null;

    this.hitboxMaskLayer = null;
    if (group.parent) {
      this.hitboxMaskLayer = utils.findHitboxMaskForGroup(group.parent, group.name);
    }
  }
  
  getLayer(document = this.document) {
    return this.utils.findLayerById(document.layers, this.group.id);
  }

  getName() {
    return this.groupName;
  }

  getNumberOfFrames() {
    const group = this.getLayer();
    return group ? group.layers.length : 0;
  }

  getFileNamePrefix() {
    return `${this.groupName}_`;
  }

  getType() {
    return this.type;
  }

  /**
   * Checks if this group has an associated hitbox mask layer.
   * @returns {boolean} True if hitbox mask exists
   */
  hasHitboxMask() {
    return this.hitboxMaskLayer !== null;
  }

  /**
   * Gets the hitbox mask layer for this group.
   * @param {Object} document - The Photoshop document
   * @returns {Object|null} The hitbox mask layer or null
   */
  getHitboxMaskLayer(document = this.document) {
    if (!this.hitboxMaskLayer) {
      return null;
    }
    return this.utils.findLayerById(document.layers, this.hitboxMaskLayer.id);
  }

  /**
   * Gets the file name for the hitbox mask export.
   * Format: <ParentName>_<ComponentName>_HitboxMask.png
   * @returns {string} The hitbox mask file name
   */
  getHitboxMaskFileName() {
    const parent = this.group.parent;
    const parentName = parent ? parent.name.replace(/[^a-zA-Z0-9]/g, "_") : "";
    const componentName = this.group.name.replace(/[^a-zA-Z0-9]/g, "_");
    return `${parentName}_${componentName}_HitboxMask.png`;
  }

  getMetadata() {
    const tagName = this.getType() || "GROUP";
    const hitboxAttr = this.hasHitboxMask() ? ` hitboxMask="${this.getHitboxMaskFileName()}"` : "";
    return `<${tagName} name="${this.groupName}" x="${this.getBounds().left}" y="${this.getBounds().top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" numberOfFrames="${this.getNumberOfFrames()}" fileNamePrefix="${this.getFileNamePrefix()}" fileNameSuffix="${this.getFileNameSuffix()}"${hitboxAttr} imageType="raster" />`;
  }

  getMetadata1x2x() {
    const tagName = this.getType() || "GROUP";
    const hitboxAttr = this.hasHitboxMask() ? ` hitboxMask="${this.getHitboxMaskFileName()}"` : "";
    return `<${tagName} name="${this.groupName}" x="${this.getBounds().left}" y="${this.getBounds().top}" width="${this.getBounds().right - this.getBounds().left}" height="${this.getBounds().bottom - this.getBounds().top}" numberOfFrames="${this.getNumberOfFrames()}" fileNamePrefix="${this.getFileNamePrefix()}" fileNameSuffix="${this.getFileNameSuffix()}" fileNameSuffix2x="${this.getFileNameSuffix2x()}"${hitboxAttr} imageType="raster" />`;
  }
}

/**
 * Export object for a text layer inside the "Text" root group.
 * Produces TEXT metadata with font properties via batchPlay; no image is exported.
 */
class TextExportObject extends ExportObject {
  constructor(document, utils, layerName) {
    super(document, utils);
    this.layerName = layerName;
  }

  getLayer(document = this.document) {
    return this.utils.findLayerByName(document.layers, this.layerName);
  }

  /**
   * Fetches text properties via batchPlay (font, style, size, color, content).
   * The DOM API doesn't expose these — batchPlay is required.
   */
  async _getTextProperties() {
    const { action } = require("photoshop");
    const layer = this.getLayer();

    const [textResult] = await action.batchPlay([{
      _obj: "get",
      _target: [
        { _property: "textKey" },
        { _ref: "layer", _id: layer.id }
      ]
    }], {});

    const tk = textResult.textKey;
    const style = tk.textStyleRange[0].textStyle;

    const c = style.color;
    const colorHex = [
      Math.round(c.red),
      Math.round(c.grain),  // "grain" = green in batchPlay
      Math.round(c.blue),
      255
    ].map(function(v) { return v.toString(16).padStart(2, "0"); }).join("").toUpperCase();

    return {
      content: tk.textKey,
      fontName: style.fontName,
      fontStyle: style.fontStyleName,
      fontSize: style.size._value,
      leading: style.leading ? style.leading._value : 0,
      tracking: style.tracking || 0,
      horizontalScale: style.horizontalScale || 100,
      verticalScale: style.verticalScale || 100,
      colorHex: colorHex
    };
  }

  /**
   * Fetches gradient overlay effect via batchPlay, if present.
   * Returns null if the layer has no gradient overlay.
   */
  async _getGradientOverlay() {
    const { action } = require("photoshop");
    const layer = this.getLayer();

    try {
      const [result] = await action.batchPlay([{
        _obj: "get",
        _target: [
          { _property: "layerEffects" },
          { _ref: "layer", _id: layer.id }
        ]
      }], {});

      const g = result.layerEffects && result.layerEffects.gradientFill;
      if (!g) return null;

      const stops = (g.gradient.colors || []).map(function(stop) {
        const sc = stop.color;
        const hex = [
          Math.round(sc.red),
          Math.round(sc.grain),
          Math.round(sc.blue),
          255
        ].map(function(v) { return v.toString(16).padStart(2, "0"); }).join("").toUpperCase();

        return {
          location: Math.round(stop.location / 4096 * 100),
          midpoint: stop.midpoint || 50,
          color: hex
        };
      });

      return {
        type: g.type._value || g.type,
        angle: g.angle ? g.angle._value : 0,
        scale: g.scale ? g.scale._value : 100,
        opacity: g.opacity ? g.opacity._value : 100,
        reverse: g.reverse || false,
        dither: g.dither || false,
        align: g.align !== undefined ? g.align : true,
        stops: stops
      };
    } catch (e) {
      return null;
    }
  }

  async getMetadata() {
    const layer = this.getLayer();
    const bounds = this.getBounds();
    const tp = await this._getTextProperties();
    const gradient = await this._getGradientOverlay();

    let inner = "";
    if (gradient) {
      const stopsXml = gradient.stops.map(function(s) {
        return `      <stop location="${s.location}" midpoint="${s.midpoint}" color="${s.color}" />`;
      }).join("\n");
      inner = `\n    <gradientOverlay type="${gradient.type}" angle="${gradient.angle}" scale="${gradient.scale}" opacity="${gradient.opacity}" reverse="${gradient.reverse}" dither="${gradient.dither}" align="${gradient.align}">\n${stopsXml}\n    </gradientOverlay>\n    `;
    }

    return `<TEXT name="${layer.name}" x="${bounds.left}" y="${bounds.top}" width="${bounds.right - bounds.left}" height="${bounds.bottom - bounds.top}" font="${tp.fontName}" style="${tp.fontStyle}" fontSize="${tp.fontSize}" leading="${tp.leading}" tracking="${tp.tracking}" horizontalScale="${tp.horizontalScale}" verticalScale="${tp.verticalScale}" color="${tp.colorHex}" imageType="vector">${inner}<![CDATA[${tp.content}]]></TEXT>`;
  }

  async getMetadata1x2x() {
    return await this.getMetadata();
  }
}

/**
 * Checks if a proposed export object exists in the document.
 * @param {Object} document - The Photoshop document
 * @param {ExportObject} exportObject - The export object to check
 * @returns {boolean} True if the layer exists
 */
function exportObjectExists(document, exportObject) {
  const layer = exportObject.getLayer(document);
  if (!layer) {
    return false;
  }
  return true;
}

/**
 * Checks if a layer is a hitbox mask (a non-group layer that matches a component name).
 * @param {Array} rootLayers - All root layers in the document
 * @param {Object} layer - The layer to check
 * @param {Utilities} utils - Utilities instance
 * @returns {boolean} True if the layer is a hitbox mask
 */
function isHitboxMask(rootLayers, layer, utils) {
  if (layer.layers && layer.layers.length > 0) {
    return false;
  }

  let parent = layer.parent;
  if (!parent || parent.parent !== null) {
    return false;
  }

  const groups = utils.getGroups(rootLayers);
  for (const group of groups) {
    if (group.id === parent.id) {
      const subGroups = utils.getGroups(group.layers);
      for (const subGroup of subGroups) {
        if (subGroup.name === layer.name) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Gets all export objects from the document based on layer structure and naming.
 * @param {Object} document - The Photoshop document
 * @param {Utilities} utils - Utilities instance
 * @returns {Array} Array of export objects
 */
function getAllExportObjects(document, utils) {
  let exportObjects = [];
  const rootLayers = document.layers;
  for (const layer of rootLayers) {
    if (layer.name.toLowerCase() === "ignore") continue;
    if (!layer.layers || layer.layers.length === 0) {
      if (!isHitboxMask(rootLayers, layer, utils)) {
        exportObjects.push(new LayerExportObject(document, utils, layer.name));
      }
    }
  }

  const groups = utils.getGroups(document.layers);
  for (const group of groups) {
    if (group.name.toLowerCase() === "ignore") continue;

    if (group.name.toLowerCase() === "text") {
      for (const layer of group.layers) {
        exportObjects.push(new TextExportObject(document, utils, layer.name));
      }
      continue;
    }

    const subGroups = utils.getGroups(group.layers);
    for (const subGroup of subGroups) {
      exportObjects.push(new GroupExportObject(document, utils, subGroup));
    }
  }

  exportObjects = exportObjects.filter(exportObject => {
    return exportObjectExists(document, exportObject);
  });

  return exportObjects;
}

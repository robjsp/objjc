"use strict";

// Extracted from https://github.com/jshint/jshint/blob/master/src/vars.js.

// Identifiers provided by the ECMAScript standard.

/*
    If the value is a boolean, it indicates whether the global is writable.
    
    If the value is an object, it should contain 'writable' and 'ignoreShadow'
    boolean properties. If 'ignoreShadow' is true, local vars that shadow the
    global will not generate a warning.
*/

exports.reserved = {
    arguments: false,
    NaN: false,
    break: false,
    continue: false,
    delete: false,
    do: false,
    new: false,
    undefined: false
};

exports.ecmaIdentifiers = {
    Array: false,
    Boolean: false,
    Date: false,
    decodeURI: false,
    decodeURIComponent: false,
    encodeURI: false,
    encodeURIComponent: false,
    Error: false,
    eval: false,
    EvalError: false,
    Function: false,
    hasOwnProperty: false,
    isFinite: false,
    isNaN: false,
    JSON: false,
    Math: false,
    Number: false,
    Object: false,
    parseInt: false,
    parseFloat: false,
    RangeError: false,
    ReferenceError: false,
    RegExp: false,
    String: false,
    SyntaxError: false,
    TypeError: false,
    URIError: false,
};

exports.newEcmaIdentifiers = {
    Set: false,
    Map: false,
    WeakMap: false,
    WeakSet: false,
    Proxy: false,
    Promise: false
};

// Global variables commonly provided by a web browser environment.

exports.browser = {
    Audio: false,
    Blob: false,
    addEventListener: false,
    applicationCache: false,
    atob: false,
    blur: { writable: false, ignoreShadow: true },
    btoa: false,
    cancelAnimationFrame: false,
    CanvasGradient: false,
    CanvasPattern: false,
    CanvasRenderingContext2D: false,
    clearInterval: false,
    clearTimeout: false,
    close: false,
    closed: { writable: false, ignoreShadow: true },
    CustomEvent: false,
    DOMParser: false,
    defaultStatus: false,
    document: { writable: false, ignoreShadow: true },
    Element: false,
    ElementTimeControl: false,
    Event: false,
    event: false,
    FileReader: false,
    FormData: false,
    focus: false,
    frames: false,
    getComputedStyle: false,
    HTMLElement: false,
    HTMLAnchorElement: false,
    HTMLBaseElement: false,
    HTMLBlockquoteElement: false,
    HTMLBodyElement: false,
    HTMLBRElement: false,
    HTMLButtonElement: false,
    HTMLCanvasElement: false,
    HTMLDirectoryElement: false,
    HTMLDivElement: false,
    HTMLDListElement: false,
    HTMLFieldSetElement: false,
    HTMLFontElement: false,
    HTMLFormElement: false,
    HTMLFrameElement: false,
    HTMLFrameSetElement: false,
    HTMLHeadElement: false,
    HTMLHeadingElement: false,
    HTMLHRElement: false,
    HTMLHtmlElement: false,
    HTMLIFrameElement: false,
    HTMLImageElement: false,
    HTMLInputElement: false,
    HTMLIsIndexElement: false,
    HTMLLabelElement: false,
    HTMLLayerElement: false,
    HTMLLegendElement: false,
    HTMLLIElement: false,
    HTMLLinkElement: false,
    HTMLMapElement: false,
    HTMLMenuElement: false,
    HTMLMetaElement: false,
    HTMLModElement: false,
    HTMLObjectElement: false,
    HTMLOListElement: false,
    HTMLOptGroupElement: false,
    HTMLOptionElement: false,
    HTMLParagraphElement: false,
    HTMLParamElement: false,
    HTMLPreElement: false,
    HTMLQuoteElement: false,
    HTMLScriptElement: false,
    HTMLSelectElement: false,
    HTMLStyleElement: false,
    HTMLTableCaptionElement: false,
    HTMLTableCellElement: false,
    HTMLTableColElement: false,
    HTMLTableElement: false,
    HTMLTableRowElement: false,
    HTMLTableSectionElement: false,
    HTMLTextAreaElement: false,
    HTMLTitleElement: false,
    HTMLUListElement: false,
    HTMLVideoElement: false,
    history: { writable: false, ignoreShadow: true },
    Image: false,
    length: { writable: false, ignoreShadow: true },
    localStorage: false,
    location: { writable: false, ignoreShadow: true },
    matchMedia: false,
    MessageChannel: false,
    MessageEvent: false,
    MessagePort: false,
    MouseEvent: false,
    moveBy: false,
    moveTo: false,
    MutationObserver: false,
    name: { writable: false, ignoreShadow: true },
    Node: false,
    NodeFilter: false,
    NodeList: false,
    navigator: false,
    onbeforeunload: true,
    onblur: true,
    onerror: true,
    onfocus: true,
    onload: true,
    onresize: true,
    onunload: true,
    open: false,
    openDatabase: false,
    opener: false,
    Option: false,
    parent: { writable: false, ignoreShadow: true },
    print: false,
    requestAnimationFrame: false,
    removeEventListener: false,
    resizeBy: false,
    resizeTo: false,
    screen: false,
    scroll: false,
    scrollBy: false,
    scrollTo: false,
    sessionStorage: false,
    setInterval: false,
    setTimeout: false,
    SharedWorker: false,
    status: { writable: false, ignoreShadow: true },
    SVGAElement: false,
    SVGAltGlyphDefElement: false,
    SVGAltGlyphElement: false,
    SVGAltGlyphItemElement: false,
    SVGAngle: false,
    SVGAnimateColorElement: false,
    SVGAnimateElement: false,
    SVGAnimateMotionElement: false,
    SVGAnimateTransformElement: false,
    SVGAnimatedAngle: false,
    SVGAnimatedBoolean: false,
    SVGAnimatedEnumeration: false,
    SVGAnimatedInteger: false,
    SVGAnimatedLength: false,
    SVGAnimatedLengthList: false,
    SVGAnimatedNumber: false,
    SVGAnimatedNumberList: false,
    SVGAnimatedPathData: false,
    SVGAnimatedPoints: false,
    SVGAnimatedPreserveAspectRatio: false,
    SVGAnimatedRect: false,
    SVGAnimatedString: false,
    SVGAnimatedTransformList: false,
    SVGAnimationElement: false,
    SVGCSSRule: false,
    SVGCircleElement: false,
    SVGClipPathElement: false,
    SVGColor: false,
    SVGColorProfileElement: false,
    SVGColorProfileRule: false,
    SVGComponentTransferFunctionElement: false,
    SVGCursorElement: false,
    SVGDefsElement: false,
    SVGDescElement: false,
    SVGDocument: false,
    SVGElement: false,
    SVGElementInstance: false,
    SVGElementInstanceList: false,
    SVGEllipseElement: false,
    SVGExternalResourcesRequired: false,
    SVGFEBlendElement: false,
    SVGFEColorMatrixElement: false,
    SVGFEComponentTransferElement: false,
    SVGFECompositeElement: false,
    SVGFEConvolveMatrixElement: false,
    SVGFEDiffuseLightingElement: false,
    SVGFEDisplacementMapElement: false,
    SVGFEDistantLightElement: false,
    SVGFEFloodElement: false,
    SVGFEFuncAElement: false,
    SVGFEFuncBElement: false,
    SVGFEFuncGElement: false,
    SVGFEFuncRElement: false,
    SVGFEGaussianBlurElement: false,
    SVGFEImageElement: false,
    SVGFEMergeElement: false,
    SVGFEMergeNodeElement: false,
    SVGFEMorphologyElement: false,
    SVGFEOffsetElement: false,
    SVGFEPointLightElement: false,
    SVGFESpecularLightingElement: false,
    SVGFESpotLightElement: false,
    SVGFETileElement: false,
    SVGFETurbulenceElement: false,
    SVGFilterElement: false,
    SVGFilterPrimitiveStandardAttributes: false,
    SVGFitToViewBox: false,
    SVGFontElement: false,
    SVGFontFaceElement: false,
    SVGFontFaceFormatElement: false,
    SVGFontFaceNameElement: false,
    SVGFontFaceSrcElement: false,
    SVGFontFaceUriElement: false,
    SVGForeignObjectElement: false,
    SVGGElement: false,
    SVGGlyphElement: false,
    SVGGlyphRefElement: false,
    SVGGradientElement: false,
    SVGHKernElement: false,
    SVGICCColor: false,
    SVGImageElement: false,
    SVGLangSpace: false,
    SVGLength: false,
    SVGLengthList: false,
    SVGLineElement: false,
    SVGLinearGradientElement: false,
    SVGLocatable: false,
    SVGMPathElement: false,
    SVGMarkerElement: false,
    SVGMaskElement: false,
    SVGMatrix: false,
    SVGMetadataElement: false,
    SVGMissingGlyphElement: false,
    SVGNumber: false,
    SVGNumberList: false,
    SVGPaint: false,
    SVGPathElement: false,
    SVGPathSeg: false,
    SVGPathSegArcAbs: false,
    SVGPathSegArcRel: false,
    SVGPathSegClosePath: false,
    SVGPathSegCurvetoCubicAbs: false,
    SVGPathSegCurvetoCubicRel: false,
    SVGPathSegCurvetoCubicSmoothAbs: false,
    SVGPathSegCurvetoCubicSmoothRel: false,
    SVGPathSegCurvetoQuadraticAbs: false,
    SVGPathSegCurvetoQuadraticRel: false,
    SVGPathSegCurvetoQuadraticSmoothAbs: false,
    SVGPathSegCurvetoQuadraticSmoothRel: false,
    SVGPathSegLinetoAbs: false,
    SVGPathSegLinetoHorizontalAbs: false,
    SVGPathSegLinetoHorizontalRel: false,
    SVGPathSegLinetoRel: false,
    SVGPathSegLinetoVerticalAbs: false,
    SVGPathSegLinetoVerticalRel: false,
    SVGPathSegList: false,
    SVGPathSegMovetoAbs: false,
    SVGPathSegMovetoRel: false,
    SVGPatternElement: false,
    SVGPoint: false,
    SVGPointList: false,
    SVGPolygonElement: false,
    SVGPolylineElement: false,
    SVGPreserveAspectRatio: false,
    SVGRadialGradientElement: false,
    SVGRect: false,
    SVGRectElement: false,
    SVGRenderingIntent: false,
    SVGSVGElement: false,
    SVGScriptElement: false,
    SVGSetElement: false,
    SVGStopElement: false,
    SVGStringList: false,
    SVGStylable: false,
    SVGStyleElement: false,
    SVGSwitchElement: false,
    SVGSymbolElement: false,
    SVGTRefElement: false,
    SVGTSpanElement: false,
    SVGTests: false,
    SVGTextContentElement: false,
    SVGTextElement: false,
    SVGTextPathElement: false,
    SVGTextPositioningElement: false,
    SVGTitleElement: false,
    SVGTransform: false,
    SVGTransformList: false,
    SVGTransformable: false,
    SVGURIReference: false,
    SVGUnitTypes: false,
    SVGUseElement: false,
    SVGVKernElement: false,
    SVGViewElement: false,
    SVGViewSpec: false,
    SVGZoomAndPan: false,
    TimeEvent: false,
    top: { writable: false, ignoreShadow: true },
    URL: false,
    WebSocket: false,
    window: false,
    Worker: false,
    XMLHttpRequest: false,
    XMLSerializer: false,
    XPathEvaluator: false,
    XPathException: false,
    XPathExpression: false,
    XPathNamespace: false,
    XPathNSResolver: false,
    XPathResult: false
};

// Extra browser reserved words

exports.devel = {
    alert: false,
    confirm: false,
    console: false,
    Debug: false,
    debugger: false,
    opera: false,
    prompt: false
};

// Widely adopted global names that are not part of ECMAScript standard

exports.nonstandard = {
    escape: false,
    unescape: false
};

// Globals provided by popular JavaScript environments.

exports.node = {
    __filename: false,
    __dirname: false,
    GLOBAL: false,
    global: false,
    root: false,
    module: false,
    require: false,

    // These globals are writeable because Node allows the following
    // usage pattern: var Buffer = require("buffer").Buffer;

    Buffer: true,
    console: true,
    exports: true,
    process: true,
    setTimeout: true,
    clearTimeout: true,
    setInterval: true,
    clearInterval: true,
    setImmediate: true,
    clearImmediate: true
};

// Cappuccino variables that should not be used as local variables

exports.cappuccino = {
    self: false,
    _cmd: false
};

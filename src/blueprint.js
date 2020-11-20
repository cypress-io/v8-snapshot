var snapshotAuxiliaryData = {}

function generateSnapshot() {
  const outerScope = this
  let process = {}
  Object.defineProperties(process, {
    platform: {
      value: 'processPlatform',
      enumerable: false,
    },
    argv: {
      value: [],
      enumerable: false,
    },
    env: {
      value: {
        NODE_ENV: 'production',
      },
      enumerable: false,
    },
    version: {
      value: 'processNodeVersion',
      enumerable: false,
    },
    versions: {
      value: { node: 'processNodeVersion' },
      enumerable: false,
    },
  })

  function get_process() {
    return process
  }

  function createElement(_type) {
    return {
      innerHTML: '',
      style: {},
    }
  }

  let documentElement = {
    textContent: '',
    style: {
      cssFloat: '',
    },
  }
  let document = {}
  Object.defineProperties(document, {
    createElement: {
      value: createElement,
      enumerable: false,
    },
    addEventListener: {
      value: function () {},
      enumerable: false,
    },
    documentElement: {
      value: documentElement,
      enumerable: false,
    },
    oninput: {
      value: {},
      enumerable: false,
    },
    onchange: {
      value: {},
      enumerable: false,
    },
  })

  function get_document() {
    return document
  }

  let global = {}
  Object.defineProperties(global, {
    document: {
      value: document,
      enumerable: false,
    },
    process: {
      value: process,
      enumerable: false,
    },
    WeakMap: {
      value: WeakMap,
      enumerable: false,
    },
    isGeneratingSnapshot: {
      value: true,
      enumerable: false,
    },
  })

  function get_global() {
    return global
  } // Globally visible function and constructor names that are available in an Electron renderer window, but not visible
  // during snapshot creation.
  // See test/samples/list-globals.js for the generation code.
  // - Manually remove "webkitURL" which is deprecated to avoid a warning on startup.

  const globalFunctionNames = [
    'USBOutTransferResult',
    'USBIsochronousOutTransferResult',
    'USBIsochronousOutTransferPacket',
    'USBIsochronousInTransferResult',
    'USBIsochronousInTransferPacket',
    'USBInTransferResult',
    'USBInterface',
    'USBEndpoint',
    'USBDevice',
    'USBConnectionEvent',
    'USBConfiguration',
    'USBAlternateInterface',
    'USB',
    'NFC',
    'BluetoothUUID',
    'BluetoothRemoteGATTService',
    'BluetoothRemoteGATTServer',
    'BluetoothRemoteGATTDescriptor',
    'BluetoothRemoteGATTCharacteristic',
    'BluetoothDevice',
    'BluetoothCharacteristicProperties',
    'Bluetooth',
    'WebAuthentication',
    'PublicKeyCredential',
    'AuthenticatorResponse',
    'AuthenticatorAttestationResponse',
    'AuthenticatorAssertionResponse',
    'WebGLRenderingContext',
    'WebGL2RenderingContext',
    'Path2D',
    'CanvasPattern',
    'CanvasGradient',
    'TextDetector',
    'FaceDetector',
    'DetectedText',
    'DetectedFace',
    'DetectedBarcode',
    'BarcodeDetector',
    'NavigationPreloadManager',
    'SensorErrorEvent',
    'Sensor',
    'RelativeOrientationSensor',
    'OrientationSensor',
    'Magnetometer',
    'LinearAccelerationSensor',
    'Gyroscope',
    'AmbientLightSensor',
    'Accelerometer',
    'AbsoluteOrientationSensor',
    'webkitSpeechRecognitionEvent',
    'webkitSpeechRecognitionError',
    'webkitSpeechRecognition',
    'webkitSpeechGrammarList',
    'webkitSpeechGrammar',
    'SpeechSynthesisUtterance',
    'SpeechSynthesisEvent',
    'RemotePlayback',
    'RTCRtpSender',
    'PushSubscriptionOptions',
    'PushSubscription',
    'PushManager',
    'PresentationReceiver',
    'PresentationConnectionList',
    'PresentationRequest',
    'PresentationConnectionCloseEvent',
    'PresentationConnectionAvailableEvent',
    'PresentationConnection',
    'PresentationAvailability',
    'Presentation',
    'PermissionStatus',
    'Permissions',
    'PaymentResponse',
    'PaymentRequestUpdateEvent',
    'PaymentRequest',
    'PaymentAddress',
    'PaymentManager',
    'Notification',
    'VideoPlaybackQuality',
    'TrackDefaultList',
    'TrackDefault',
    'CanvasCaptureMediaStreamTrack',
    'PhotoCapabilities',
    'MediaSettingsRange',
    'ImageCapture',
    'IDBObserverChanges',
    'IDBObserver',
    'IDBObservation',
    'StorageManager',
    'CompositorWorker',
    'BudgetService',
    'BroadcastChannel',
    'SyncManager',
    'BackgroundFetchRegistration',
    'BackgroundFetchManager',
    'BackgroundFetchFetch',
    'AudioParamMap',
    'XSLTProcessor',
    'Worklet',
    'VTTRegion',
    'KeyframeEffectReadOnly',
    'KeyframeEffect',
    'DocumentTimeline',
    'AnimationTimeline',
    'AnimationPlaybackEvent',
    'AnimationEffectTimingReadOnly',
    'AnimationEffectTiming',
    'AnimationEffectReadOnly',
    'Animation',
    'VisualViewport',
    'SharedWorker',
    'PerformanceServerTiming',
    'SVGMPathElement',
    'SVGDiscardElement',
    'SVGAnimationElement',
    'ResizeObserverEntry',
    'ResizeObserver',
    'PerformancePaintTiming',
    'PerformanceObserverEntryList',
    'PerformanceObserver',
    'PerformanceNavigationTiming',
    'IntersectionObserverEntry',
    'IntersectionObserver',
    'StaticRange',
    'InputEvent',
    'DOMRectReadOnly',
    'DOMRect',
    'DOMQuad',
    'DOMPointReadOnly',
    'DOMPoint',
    'DOMMatrixReadOnly',
    'DOMMatrix',
    'ScrollTimeline',
    'StylePropertyMapReadonly',
    'StylePropertyMap',
    'CSSVariableReferenceValue',
    'CSSURLImageValue',
    'CSSUnparsedValue',
    'CSSUnitValue',
    'CSSTranslation',
    'CSSTransformValue',
    'CSSTransformComponent',
    'CSSStyleValue',
    'CSSSkew',
    'CSSScale',
    'CSSRotation',
    'CSSResourceValue',
    'CSSPositionValue',
    'CSSPerspective',
    'CSSNumericValue',
    'CSSMatrixComponent',
    'CSSKeywordValue',
    'CSSImageValue',
    'VideoTrackList',
    'VideoTrack',
    'AudioTrackList',
    'AudioTrack',
    'AccessibleNodeList',
    'AccessibleNode',
    'webkitRTCPeerConnection',
    'webkitMediaStream',
    'WebSocket',
    'WebGLVertexArrayObject',
    'WebGLUniformLocation',
    'WebGLTransformFeedback',
    'WebGLTexture',
    'WebGLSync',
    'WebGLShaderPrecisionFormat',
    'WebGLShader',
    'WebGLSampler',
    'WebGLRenderbuffer',
    'WebGLQuery',
    'WebGLProgram',
    'WebGLFramebuffer',
    'WebGLContextEvent',
    'WebGLBuffer',
    'WebGLActiveInfo',
    'WaveShaperNode',
    'TextEncoder',
    'TextDecoder',
    'SubtleCrypto',
    'StorageEvent',
    'Storage',
    'StereoPannerNode',
    'SourceBufferList',
    'SourceBuffer',
    'ServiceWorkerRegistration',
    'ServiceWorkerContainer',
    'ServiceWorker',
    'ScriptProcessorNode',
    'ScreenOrientation',
    'Response',
    'Request',
    'RTCStatsReport',
    'RTCSessionDescription',
    'RTCRtpReceiver',
    'RTCRtpContributingSource',
    'RTCPeerConnectionIceEvent',
    'RTCPeerConnection',
    'RTCIceCandidate',
    'RTCDataChannelEvent',
    'RTCDataChannel',
    'RTCCertificate',
    'Plugin',
    'PluginArray',
    'PeriodicWave',
    'PasswordCredential',
    'PannerNode',
    'OscillatorNode',
    'OfflineAudioContext',
    'OfflineAudioCompletionEvent',
    'NetworkInformation',
    'MimeType',
    'MimeTypeArray',
    'MediaStreamTrackEvent',
    'MediaStreamTrack',
    'MediaStreamEvent',
    'MediaStream',
    'MediaStreamAudioSourceNode',
    'MediaStreamAudioDestinationNode',
    'MediaSource',
    'MediaRecorder',
    'MediaKeys',
    'MediaKeySystemAccess',
    'MediaKeyStatusMap',
    'MediaKeySession',
    'MediaKeyMessageEvent',
    'MediaEncryptedEvent',
    'MediaElementAudioSourceNode',
    'MediaDevices',
    'MediaDeviceInfo',
    'MIDIPort',
    'MIDIOutputMap',
    'MIDIOutput',
    'MIDIMessageEvent',
    'MIDIInputMap',
    'MIDIInput',
    'MIDIConnectionEvent',
    'MIDIAccess',
    'ImageBitmapRenderingContext',
    'IIRFilterNode',
    'IDBVersionChangeEvent',
    'IDBTransaction',
    'IDBRequest',
    'IDBOpenDBRequest',
    'IDBObjectStore',
    'IDBKeyRange',
    'IDBIndex',
    'IDBFactory',
    'IDBDatabase',
    'IDBCursorWithValue',
    'IDBCursor',
    'Headers',
    'GamepadEvent',
    'Gamepad',
    'GamepadButton',
    'GainNode',
    'FederatedCredential',
    'EventSource',
    'DynamicsCompressorNode',
    'DeviceOrientationEvent',
    'DeviceMotionEvent',
    'DelayNode',
    'DOMError',
    'CryptoKey',
    'Crypto',
    'CredentialsContainer',
    'Credential',
    'ConvolverNode',
    'ConstantSourceNode',
    'CloseEvent',
    'ChannelSplitterNode',
    'ChannelMergerNode',
    'CanvasRenderingContext2D',
    'CacheStorage',
    'Cache',
    'BlobEvent',
    'BiquadFilterNode',
    'BeforeInstallPromptEvent',
    'BatteryManager',
    'BaseAudioContext',
    'AudioScheduledSourceNode',
    'AudioProcessingEvent',
    'AudioParam',
    'AudioNode',
    'AudioListener',
    'AudioDestinationNode',
    'AudioContext',
    'AudioBufferSourceNode',
    'AudioBuffer',
    'AppBannerPromptResult',
    'AnalyserNode',
    'postMessage',
    'blur',
    'focus',
    'close',
    'XPathResult',
    'XPathExpression',
    'XPathEvaluator',
    'XMLSerializer',
    'XMLHttpRequestUpload',
    'XMLHttpRequestEventTarget',
    'XMLHttpRequest',
    'XMLDocument',
    'Worker',
    'Window',
    'WheelEvent',
    'ValidityState',
    'VTTCue',
    'URLSearchParams',
    'URL',
    'UIEvent',
    'TreeWalker',
    'TransitionEvent',
    'TrackEvent',
    'TouchList',
    'TouchEvent',
    'Touch',
    'TimeRanges',
    'TextTrackList',
    'TextTrackCueList',
    'TextTrackCue',
    'TextTrack',
    'TextMetrics',
    'TextEvent',
    'Text',
    'TaskAttributionTiming',
    'StyleSheetList',
    'StyleSheet',
    'ShadowRoot',
    'Selection',
    'SecurityPolicyViolationEvent',
    'Screen',
    'SVGViewElement',
    'SVGUseElement',
    'SVGUnitTypes',
    'SVGTransformList',
    'SVGTransform',
    'SVGTitleElement',
    'SVGTextPositioningElement',
    'SVGTextPathElement',
    'SVGTextElement',
    'SVGTextContentElement',
    'SVGTSpanElement',
    'SVGSymbolElement',
    'SVGSwitchElement',
    'SVGStyleElement',
    'SVGStringList',
    'SVGStopElement',
    'SVGSetElement',
    'SVGScriptElement',
    'SVGSVGElement',
    'SVGRectElement',
    'SVGRect',
    'SVGRadialGradientElement',
    'SVGPreserveAspectRatio',
    'SVGPolylineElement',
    'SVGPolygonElement',
    'SVGPointList',
    'SVGPoint',
    'SVGPatternElement',
    'SVGPathElement',
    'SVGNumberList',
    'SVGNumber',
    'SVGMetadataElement',
    'SVGMatrix',
    'SVGMaskElement',
    'SVGMarkerElement',
    'SVGLinearGradientElement',
    'SVGLineElement',
    'SVGLengthList',
    'SVGLength',
    'SVGImageElement',
    'SVGGraphicsElement',
    'SVGGradientElement',
    'SVGGeometryElement',
    'SVGGElement',
    'SVGForeignObjectElement',
    'SVGFilterElement',
    'SVGFETurbulenceElement',
    'SVGFETileElement',
    'SVGFESpotLightElement',
    'SVGFESpecularLightingElement',
    'SVGFEPointLightElement',
    'SVGFEOffsetElement',
    'SVGFEMorphologyElement',
    'SVGFEMergeNodeElement',
    'SVGFEMergeElement',
    'SVGFEImageElement',
    'SVGFEGaussianBlurElement',
    'SVGFEFuncRElement',
    'SVGFEFuncGElement',
    'SVGFEFuncBElement',
    'SVGFEFuncAElement',
    'SVGFEFloodElement',
    'SVGFEDropShadowElement',
    'SVGFEDistantLightElement',
    'SVGFEDisplacementMapElement',
    'SVGFEDiffuseLightingElement',
    'SVGFEConvolveMatrixElement',
    'SVGFECompositeElement',
    'SVGFEComponentTransferElement',
    'SVGFEColorMatrixElement',
    'SVGFEBlendElement',
    'SVGEllipseElement',
    'SVGElement',
    'SVGDescElement',
    'SVGDefsElement',
    'SVGComponentTransferFunctionElement',
    'SVGClipPathElement',
    'SVGCircleElement',
    'SVGAnimatedTransformList',
    'SVGAnimatedString',
    'SVGAnimatedRect',
    'SVGAnimatedPreserveAspectRatio',
    'SVGAnimatedNumberList',
    'SVGAnimatedNumber',
    'SVGAnimatedLengthList',
    'SVGAnimatedLength',
    'SVGAnimatedInteger',
    'SVGAnimatedEnumeration',
    'SVGAnimatedBoolean',
    'SVGAnimatedAngle',
    'SVGAnimateTransformElement',
    'SVGAnimateMotionElement',
    'SVGAnimateElement',
    'SVGAngle',
    'SVGAElement',
    'Range',
    'RadioNodeList',
    'PromiseRejectionEvent',
    'ProgressEvent',
    'ProcessingInstruction',
    'PopStateEvent',
    'PointerEvent',
    'PerformanceTiming',
    'PerformanceResourceTiming',
    'PerformanceNavigation',
    'PerformanceMeasure',
    'PerformanceMark',
    'PerformanceLongTaskTiming',
    'PerformanceEntry',
    'Performance',
    'PageTransitionEvent',
    'NodeList',
    'NodeIterator',
    'NodeFilter',
    'Node',
    'Navigator',
    'NamedNodeMap',
    'MutationRecord',
    'MutationObserver',
    'MutationEvent',
    'MouseEvent',
    'MessagePort',
    'MessageEvent',
    'MessageChannel',
    'MediaQueryListEvent',
    'MediaQueryList',
    'MediaList',
    'MediaError',
    'Location',
    'KeyboardEvent',
    'InputDeviceCapabilities',
    'ImageData',
    'ImageBitmap',
    'IdleDeadline',
    'History',
    'HashChangeEvent',
    'HTMLVideoElement',
    'HTMLUnknownElement',
    'HTMLUListElement',
    'HTMLTrackElement',
    'HTMLTitleElement',
    'HTMLTextAreaElement',
    'HTMLTemplateElement',
    'HTMLTableSectionElement',
    'HTMLTableRowElement',
    'HTMLTableElement',
    'HTMLTableColElement',
    'HTMLTableCellElement',
    'HTMLTableCaptionElement',
    'HTMLStyleElement',
    'HTMLSpanElement',
    'HTMLSourceElement',
    'HTMLSlotElement',
    'HTMLShadowElement',
    'HTMLSelectElement',
    'HTMLScriptElement',
    'HTMLQuoteElement',
    'HTMLProgressElement',
    'HTMLPreElement',
    'HTMLPictureElement',
    'HTMLParamElement',
    'HTMLParagraphElement',
    'HTMLOutputElement',
    'HTMLOptionsCollection',
    'Option',
    'HTMLOptionElement',
    'HTMLOptGroupElement',
    'HTMLObjectElement',
    'HTMLOListElement',
    'HTMLModElement',
    'HTMLMeterElement',
    'HTMLMetaElement',
    'HTMLMenuElement',
    'HTMLMediaElement',
    'HTMLMarqueeElement',
    'HTMLMapElement',
    'HTMLLinkElement',
    'HTMLLegendElement',
    'HTMLLabelElement',
    'HTMLLIElement',
    'HTMLInputElement',
    'Image',
    'HTMLImageElement',
    'HTMLIFrameElement',
    'HTMLHtmlElement',
    'HTMLHeadingElement',
    'HTMLHeadElement',
    'HTMLHRElement',
    'HTMLFrameSetElement',
    'HTMLFrameElement',
    'HTMLFormElement',
    'HTMLFormControlsCollection',
    'HTMLFontElement',
    'HTMLFieldSetElement',
    'HTMLEmbedElement',
    'HTMLElement',
    'HTMLDocument',
    'HTMLDivElement',
    'HTMLDirectoryElement',
    'HTMLDialogElement',
    'HTMLDetailsElement',
    'HTMLDataListElement',
    'HTMLDListElement',
    'HTMLContentElement',
    'HTMLCollection',
    'HTMLCanvasElement',
    'HTMLButtonElement',
    'HTMLBodyElement',
    'HTMLBaseElement',
    'HTMLBRElement',
    'Audio',
    'HTMLAudioElement',
    'HTMLAreaElement',
    'HTMLAnchorElement',
    'HTMLAllCollection',
    'FormData',
    'FontFaceSetLoadEvent',
    'FontFace',
    'FocusEvent',
    'FileReader',
    'FileList',
    'File',
    'EventTarget',
    'Event',
    'ErrorEvent',
    'Element',
    'DragEvent',
    'DocumentType',
    'DocumentFragment',
    'Document',
    'DataTransferItemList',
    'DataTransferItem',
    'DataTransfer',
    'DOMTokenList',
    'DOMStringMap',
    'DOMStringList',
    'DOMParser',
    'DOMImplementation',
    'DOMException',
    'CustomEvent',
    'CustomElementRegistry',
    'CompositionEvent',
    'Comment',
    'ClipboardEvent',
    'Clipboard',
    'CharacterData',
    'CSSViewportRule',
    'CSSSupportsRule',
    'CSSStyleSheet',
    'CSSStyleRule',
    'CSSStyleDeclaration',
    'CSSRuleList',
    'CSSRule',
    'CSSPageRule',
    'CSSNamespaceRule',
    'CSSMediaRule',
    'CSSKeyframesRule',
    'CSSKeyframeRule',
    'CSSImportRule',
    'CSSGroupingRule',
    'CSSFontFaceRule',
    'CSS',
    'CSSConditionRule',
    'CDATASection',
    'Blob',
    'BeforeUnloadEvent',
    'BarProp',
    'Attr',
    'ApplicationCacheErrorEvent',
    'ApplicationCache',
    'AnimationEvent',
    'WebKitCSSMatrix',
    'WebKitMutationObserver',
    'WebKitAnimationEvent',
    'WebKitTransitionEvent',
    'onerror',
    'onload',
    'stop',
    'open',
    'alert',
    'confirm',
    'prompt',
    'print',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'captureEvents',
    'releaseEvents',
    'getComputedStyle',
    'matchMedia',
    'moveTo',
    'moveBy',
    'resizeTo',
    'resizeBy',
    'getSelection',
    'find',
    'getMatchedCSSRules',
    'webkitRequestAnimationFrame',
    'webkitCancelAnimationFrame',
    'btoa',
    'atob',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'createImageBitmap',
    'scroll',
    'scrollTo',
    'scrollBy',
    'fetch',
    'getComputedStyleMap',
    'webkitRequestFileSystem',
    'webkitResolveLocalFileSystemURL',
    'openDatabase',
    'SharedArrayBuffer',
    'Buffer',
    'setImmediate',
    'clearImmediate',
    'require',
    'BudgetState',
    'WebView',
    'measure',
    'profile',
    'dir',
    'dirxml',
    'profileEnd',
    'clear',
    'table',
    'keys',
    'values',
    'debug',
    'undebug',
    'monitor',
    'unmonitor',
    'inspect',
    'copy',
    'getEventListeners',
    'monitorEvents',
    'unmonitorEvents',
    '$',
    '$$',
    '$x',
  ] // During snapshot generation, this is null.
  // After snapshot load and setGlobals() is called, this is an object with global function names as keys and the real
  // global functions as values.

  let globalFunctionTrampoline = null // Create a placeholder function to install as a global in place of a function that may be available after snapshot
  // load, at runtime. Uses the current state of globalFunctionTrampoline to either call the real function or throw
  // an appropriate error for improper use.

  function makeGlobalPlaceholder(globalFunctionName) {
    return function () {
      if (globalFunctionTrampoline === null) {
        throw new Error(
          `Attempt to call ${globalFunctionName} during snapshot generation or before snapshotResult.setGlobals()`
        )
      } else if (globalFunctionTrampoline[globalFunctionName] === undefined) {
        throw new ReferenceError(
          `Global method ${globalFunctionName} was still not defined after the snapshot was loaded`
        )
      } else if (new.target === undefined) {
        // Not called as a constructor
        return globalFunctionTrampoline[globalFunctionName](...arguments)
      } else {
        // Called as a constructor
        return new globalFunctionTrampoline[globalFunctionName](...arguments)
      }
    }
  } // Install a placeholder function for each global function we expect to have access to at runtime. Placeholder
  // functions are set as properties on our "global" stand-in and also in this function's scope, so bare references
  // will also capture the placeholder function (`var a = setTimeout` and `var a = global.setTimeout`).

  for (const globalFunctionName of globalFunctionNames) {
    if (outerScope[globalFunctionName] !== undefined) {
      // This happens when the snapshot script is eval'd in tests.
      continue
    }

    const placeholder = makeGlobalPlaceholder(globalFunctionName)
    Object.defineProperties(global, {
      [globalFunctionName]: {
        value: placeholder,
        enumerable: false,
      },
    })
    outerScope[globalFunctionName] = placeholder
  }

  let window = {}
  Object.defineProperties(window, {
    document: {
      value: document,
      enumerable: false,
    },
    location: {
      value: {
        href: '',
      },
      enumerable: false,
    },
    addEventListener: {
      value: function () {},
      enumerable: false,
    },
    screen: {
      value: {},
      enumerable: false,
    },
  })

  function get_window() {
    return window
  }

  let console = {}

  function consoleNoop() {
    throw new Error('Cannot use `console` functions in the snapshot.')
  }

  Object.defineProperties(console, {
    debug: {
      value: consoleNoop,
      enumerable: false,
    },
    error: {
      value: consoleNoop,
      enumerable: false,
    },
    info: {
      value: consoleNoop,
      enumerable: false,
    },
    log: {
      value: consoleNoop,
      enumerable: false,
    },
    warn: {
      value: consoleNoop,
      enumerable: false,
    },
    time: {
      value: consoleNoop,
      enumerable: false,
    },
    timeEnd: {
      value: consoleNoop,
      enumerable: false,
    },
  })

  function get_console() {
    return console
  }

  let require = (moduleName) => {
    throw new Error(
      `Cannot require module "${moduleName}".\n` +
        "To use Node's require you need to call `snapshotResult.setGlobals` first!"
    )
  }

  //
  // Core module stubs with reduced functionality
  //
  function getCoreUtil() {
    function inherits(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true,
          },
        })
      }
    }
    return { inherits }
  }

  function getCoreEvents() {
    var R = typeof Reflect === 'object' ? Reflect : null
    var ReflectApply =
      R && typeof R.apply === 'function'
        ? R.apply
        : function ReflectApply(target, receiver, args) {
            return Function.prototype.apply.call(target, receiver, args)
          }

    var ReflectOwnKeys
    if (R && typeof R.ownKeys === 'function') {
      ReflectOwnKeys = R.ownKeys
    } else if (Object.getOwnPropertySymbols) {
      ReflectOwnKeys = function ReflectOwnKeys(target) {
        return Object.getOwnPropertyNames(target).concat(
          Object.getOwnPropertySymbols(target)
        )
      }
    } else {
      ReflectOwnKeys = function ReflectOwnKeys(target) {
        return Object.getOwnPropertyNames(target)
      }
    }

    function ProcessEmitWarning(warning) {
      if (console && console.warn) console.warn(warning)
    }

    var NumberIsNaN =
      Number.isNaN ||
      function NumberIsNaN(value) {
        return value !== value
      }

    function EventEmitter() {
      EventEmitter.init.call(this)
    }
    const events = EventEmitter
    events.once = once

    // Backwards-compat with node 0.10.x
    EventEmitter.EventEmitter = EventEmitter

    EventEmitter.prototype._events = undefined
    EventEmitter.prototype._eventsCount = 0
    EventEmitter.prototype._maxListeners = undefined

    // By default EventEmitters will print a warning if more than 10 listeners are
    // added to it. This is a useful default which helps finding memory leaks.
    var defaultMaxListeners = 10

    function checkListener(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError(
          `The "listener" argument must be of type Function. Received type ${typeof listenereof}`
        )
      }
    }

    Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
      enumerable: true,
      get: function () {
        return defaultMaxListeners
      },
      set: function (arg) {
        if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
          throw new RangeError(
            `The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ${arg}.`
          )
        }
        defaultMaxListeners = arg
      },
    })

    EventEmitter.init = function () {
      if (
        this._events === undefined ||
        this._events === Object.getPrototypeOf(this)._events
      ) {
        this._events = Object.create(null)
        this._eventsCount = 0
      }

      this._maxListeners = this._maxListeners || undefined
    }

    EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
      if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
        throw new RangeError(
          `The value of "n" is out of range. It must be a non-negative number. Received ${n}.`
        )
      }
      this._maxListeners = n
      return this
    }

    function _getMaxListeners(that) {
      if (that._maxListeners === undefined)
        return EventEmitter.defaultMaxListeners
      return that._maxListeners
    }

    EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
      return _getMaxListeners(this)
    }

    EventEmitter.prototype.emit = function emit(type) {
      var args = []
      for (var i = 1; i < arguments.length; i++) args.push(arguments[i])
      var doError = type === 'error'

      var events = this._events
      if (events !== undefined) doError = doError && events.error === undefined
      else if (!doError) return false

      if (doError) {
        var er
        if (args.length > 0) er = args[0]
        if (er instanceof Error) {
          throw er // Unhandled 'error' event
        }
        var err = new Error(
          `Unhandled error.${er ? ' (' + er.message + ')' : ''}`
        )
        err.context = er
        throw err // Unhandled 'error' event
      }

      var handler = events[type]

      if (handler === undefined) return false

      if (typeof handler === 'function') {
        ReflectApply(handler, this, args)
      } else {
        var len = handler.length
        var listeners = arrayClone(handler, len)
        for (var i = 0; i < len; ++i) ReflectApply(listeners[i], this, args)
      }

      return true
    }

    function _addListener(target, type, listener, prepend) {
      var m
      var events
      var existing

      checkListener(listener)

      events = target._events
      if (events === undefined) {
        events = target._events = Object.create(null)
        target._eventsCount = 0
      } else {
        if (events.newListener !== undefined) {
          target.emit(
            'newListener',
            type,
            listener.listener ? listener.listener : listener
          )

          events = target._events
        }
        existing = events[type]
      }

      if (existing === undefined) {
        // Optimize the case of one listener. Don't need the extra array object.
        existing = events[type] = listener
        ++target._eventsCount
      } else {
        if (typeof existing === 'function') {
          // Adding the second element, need to change to array.
          existing = events[type] = prepend
            ? [listener, existing]
            : [existing, listener]
          // If we've already got an array, just append.
        } else if (prepend) {
          existing.unshift(listener)
        } else {
          existing.push(listener)
        }

        m = _getMaxListeners(target)
        if (m > 0 && existing.length > m && !existing.warned) {
          existing.warned = true
          var w = new Error(
            `Possible EventEmitter memory leak detected. ${
              existing.length
            } ${String(
              type
            )} listeners added. Use emitter.setMaxListeners() to increase limit`
          )
          w.name = 'MaxListenersExceededWarning'
          w.emitter = target
          w.type = type
          w.count = existing.length
          ProcessEmitWarning(w)
        }
      }

      return target
    }

    EventEmitter.prototype.addListener = function addListener(type, listener) {
      return _addListener(this, type, listener, false)
    }

    EventEmitter.prototype.on = EventEmitter.prototype.addListener

    EventEmitter.prototype.prependListener = function prependListener(
      type,
      listener
    ) {
      return _addListener(this, type, listener, true)
    }

    function onceWrapper() {
      if (!this.fired) {
        this.target.removeListener(this.type, this.wrapFn)
        this.fired = true
        if (arguments.length === 0) return this.listener.call(this.target)
        return this.listener.apply(this.target, arguments)
      }
    }

    function _onceWrap(target, type, listener) {
      var state = {
        fired: false,
        wrapFn: undefined,
        target: target,
        type: type,
        listener: listener,
      }
      var wrapped = onceWrapper.bind(state)
      wrapped.listener = listener
      state.wrapFn = wrapped
      return wrapped
    }

    EventEmitter.prototype.once = function once(type, listener) {
      checkListener(listener)
      this.on(type, _onceWrap(this, type, listener))
      return this
    }

    EventEmitter.prototype.prependOnceListener = function prependOnceListener(
      type,
      listener
    ) {
      checkListener(listener)
      this.prependListener(type, _onceWrap(this, type, listener))
      return this
    }

    // Emits a 'removeListener' event if and only if the listener was removed.
    EventEmitter.prototype.removeListener = function removeListener(
      type,
      listener
    ) {
      var list, events, position, i, originalListener

      checkListener(listener)

      events = this._events
      if (events === undefined) return this

      list = events[type]
      if (list === undefined) return this

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0) this._events = Object.create(null)
        else {
          delete events[type]
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener)
        }
      } else if (typeof list !== 'function') {
        position = -1

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener
            position = i
            break
          }
        }

        if (position < 0) return this

        if (position === 0) list.shift()
        else {
          spliceOne(list, position)
        }

        if (list.length === 1) events[type] = list[0]

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener)
      }

      return this
    }

    EventEmitter.prototype.off = EventEmitter.prototype.removeListener

    EventEmitter.prototype.removeAllListeners = function removeAllListeners(
      type
    ) {
      var listeners, events, i

      events = this._events
      if (events === undefined) return this

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null)
          this._eventsCount = 0
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0) this._events = Object.create(null)
          else delete events[type]
        }
        return this
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events)
        var key
        for (i = 0; i < keys.length; ++i) {
          key = keys[i]
          if (key === 'removeListener') continue
          this.removeAllListeners(key)
        }
        this.removeAllListeners('removeListener')
        this._events = Object.create(null)
        this._eventsCount = 0
        return this
      }

      listeners = events[type]

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners)
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i])
        }
      }

      return this
    }

    function _listeners(target, type, unwrap) {
      var events = target._events

      if (events === undefined) return []

      var evlistener = events[type]
      if (evlistener === undefined) return []

      if (typeof evlistener === 'function')
        return unwrap ? [evlistener.listener || evlistener] : [evlistener]

      return unwrap
        ? unwrapListeners(evlistener)
        : arrayClone(evlistener, evlistener.length)
    }

    EventEmitter.prototype.listeners = function listeners(type) {
      return _listeners(this, type, true)
    }

    EventEmitter.prototype.rawListeners = function rawListeners(type) {
      return _listeners(this, type, false)
    }

    EventEmitter.listenerCount = function (emitter, type) {
      if (typeof emitter.listenerCount === 'function') {
        return emitter.listenerCount(type)
      } else {
        return listenerCount.call(emitter, type)
      }
    }

    EventEmitter.prototype.listenerCount = listenerCount
    function listenerCount(type) {
      var events = this._events

      if (events !== undefined) {
        var evlistener = events[type]

        if (typeof evlistener === 'function') {
          return 1
        } else if (evlistener !== undefined) {
          return evlistener.length
        }
      }

      return 0
    }

    EventEmitter.prototype.eventNames = function eventNames() {
      return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : []
    }

    function arrayClone(arr, n) {
      var copy = new Array(n)
      for (var i = 0; i < n; ++i) copy[i] = arr[i]
      return copy
    }

    function spliceOne(list, index) {
      for (; index + 1 < list.length; index++) list[index] = list[index + 1]
      list.pop()
    }

    function unwrapListeners(arr) {
      var ret = new Array(arr.length)
      for (var i = 0; i < ret.length; ++i) {
        ret[i] = arr[i].listener || arr[i]
      }
      return ret
    }

    function once(emitter, name) {
      return new Promise(function (resolve, reject) {
        function eventListener() {
          if (errorListener !== undefined) {
            emitter.removeListener('error', errorListener)
          }
          resolve([].slice.call(arguments))
        }
        var errorListener

        if (name !== 'error') {
          errorListener = function errorListener(err) {
            emitter.removeListener(name, eventListener)
            reject(err)
          }

          emitter.once('error', errorListener)
        }

        emitter.once(name, eventListener)
      })
    }
    return events
  }

  const coreStubs = {
    util: getCoreUtil(),
    events: getCoreEvents(),
  }

  //
  // End Core module stubs
  //

  function customRequire(modulePath) {
    let module = customRequire.cache[modulePath]

    if (!module) {
      module = {
        exports: {},
      }
      const dirname = modulePath.split('/').slice(0, -1).join('/')

      function define(callback) {
        callback(customRequire, module.exports, module)
      }

      if (customRequire.definitions.hasOwnProperty(modulePath)) {
        customRequire.cache[modulePath] = module
        customRequire.definitions[modulePath].apply(module.exports, [
          module.exports,
          module,
          modulePath,
          dirname,
          customRequire,
          define,
        ])
      } else if (coreStubs.hasOwnProperty(modulePath)) {
        module.exports = coreStubs[modulePath]
        // we don't cache core modules but only serve stubs to not break snapsshotting
      } else {
        module.exports = require(modulePath)
        customRequire.cache[modulePath] = module
      }
    }

    return module.exports
  }

  customRequire.extensions = {}
  customRequire.cache = {}
  customRequire.definitions = {}

  customRequire.resolve = function (mod) {
    return require.resolve(mod)
  }

  customRequire(mainModuleRequirePath)
  return {
    customRequire,
    setGlobals: function (
      newGlobal,
      newProcess,
      newWindow,
      newDocument,
      newConsole,
      nodeRequire
    ) {
      // Populate the global function trampoline with the real global functions defined on newGlobal.
      globalFunctionTrampoline = newGlobal

      for (let key of Object.keys(global)) {
        newGlobal[key] = global[key]
      }

      global = newGlobal

      for (let key of Object.keys(process)) {
        newProcess[key] = process[key]
      }

      process = newProcess

      for (let key of Object.keys(window)) {
        newWindow[key] = window[key]
      }

      window = newWindow

      for (let key of Object.keys(document)) {
        newDocument[key] = document[key]
      }

      document = newDocument

      for (let key of Object.keys(console)) {
        newConsole[key] = console[key]
      }

      console = newConsole
      require = nodeRequire
    },
    translateSnapshotRow: function (row) {
      let low = 0
      let high = snapshotAuxiliaryData.snapshotSections.length - 1

      while (low <= high) {
        const mid = low + ((high - low) >> 1)
        const section = snapshotAuxiliaryData.snapshotSections[mid]

        if (row < section.startRow) {
          high = mid - 1
        } else if (row >= section.endRow) {
          low = mid + 1
        } else {
          return {
            relativePath: section.relativePath,
            row: row - section.startRow,
          }
        }
      }

      return {
        relativePath: '<embedded>',
        row: row,
      }
    },
  }
}

snapshotAuxiliaryData.snapshotSections = []
var snapshotResult = generateSnapshot.call({}) // Delete the generateSnapshot function to prevent it from appearing in the
// global scope and causing slowdowns when the function is particularly big.

generateSnapshot = null

import { Group, Vector2, Vector3 } from "three"

const THREE = window.THREE
  ? window.THREE // Prefer consumption from global THREE, if exists
  : {
      Group,
      Vector2,
      Vector3,
    }

import TWEEN from "@tweenjs/tween.js"
import Kapsule from "kapsule"

import {
  cartesian2Polar,
  getGlobeRadius,
  polar2Cartesian,
} from "./utils/coordTranslate"
import { emptyObject } from "./utils/gc"
import linkKapsule from "./utils/kapsule-link.js"

import CustomLayerKapsule from "./layers/custom"
import GlobeLayerKapsule from "./layers/globe"
import HtmlElementsLayerKapsule from "./layers/htmlElements"
import LabelsLayerKapsule from "./layers/labels"
import ObjectsLayerKapsule from "./layers/objects"
import PathsLayerKapsule from "./layers/paths"

//
const layers = [
  "globeLayer",
  "pathsLayer",
  "labelsLayer",
  "htmlElementsLayer",
  "objectsLayer",
  "customLayer",
]

// Expose config from layers
const bindGlobeLayer = linkKapsule("globeLayer", GlobeLayerKapsule)
const linkedGlobeLayerProps = Object.assign(
  ...[
    "globeImageUrl",
    "bumpImageUrl",
    "showGlobe",
    "showGraticules",
    "showAtmosphere",
    "atmosphereColor",
    "atmosphereAltitude",
  ].map((p) => ({ [p]: bindGlobeLayer.linkProp(p) }))
)

const linkedGlobeLayerMethods = Object.assign(
  ...["globeMaterial"].map((p) => ({ [p]: bindGlobeLayer.linkMethod(p) }))
)

const bindLabelsLayer = linkKapsule("labelsLayer", LabelsLayerKapsule)
const linkedLabelsLayerProps = Object.assign(
  ...[
    "labelsData",
    "labelLat",
    "labelLng",
    "labelAltitude",
    "labelRotation",
    "labelText",
    "labelSize",
    "labelTypeFace",
    "labelColor",
    "labelResolution",
    "labelIncludeDot",
    "labelDotRadius",
    "labelDotOrientation",
    "labelsTransitionDuration",
  ].map((p) => ({ [p]: bindLabelsLayer.linkProp(p) }))
)

const bindHtmlElementsLayer = linkKapsule(
  "htmlElementsLayer",
  HtmlElementsLayerKapsule
)
const linkedHtmlElementsLayerProps = Object.assign(
  ...[
    "htmlElementsData",
    "htmlLat",
    "htmlLng",
    "htmlAltitude",
    "htmlElement",
    "htmlTransitionDuration",
  ].map((p) => ({ [p]: bindHtmlElementsLayer.linkProp(p) }))
)

const bindObjectsLayer = linkKapsule("objectsLayer", ObjectsLayerKapsule)
const linkedObjectsLayerProps = Object.assign(
  ...[
    "objectsData",
    "objectLat",
    "objectLng",
    "objectAltitude",
    "objectThreeObject",
  ].map((p) => ({ [p]: bindObjectsLayer.linkProp(p) }))
)

const bindPathsLayer = linkKapsule("pathsLayer", PathsLayerKapsule)
const linkedPathsLayerProps = Object.assign(
  ...[
    "pathsData",
    "pathPoints",
    "pathPointLat",
    "pathPointLng",
    "pathPointAlt",
    "pathResolution",
    "pathColor",
    "pathStroke",
    "pathDashLength",
    "pathDashGap",
    "pathDashInitialGap",
    "pathDashAnimateTime",
    "pathTransitionDuration",
  ].map((p) => ({ [p]: bindPathsLayer.linkProp(p) }))
)

const bindCustomLayer = linkKapsule("customLayer", CustomLayerKapsule)
const linkedCustomLayerProps = Object.assign(
  ...["customLayerData", "customThreeObject", "customThreeObjectUpdate"].map(
    (p) => ({ [p]: bindCustomLayer.linkProp(p) })
  )
)

//

export default Kapsule({
  props: {
    onGlobeReady: { triggerUpdate: false },
    rendererSize: {
      default: new THREE.Vector2(window.innerWidth, window.innerHeight),
      onChange(rendererSize, state) {
        console.log(state)
        state.pathsLayer.rendererSize(rendererSize)
      },
      triggerUpdate: false,
    },
    ...linkedGlobeLayerProps,
    ...linkedPathsLayerProps,
    ...linkedLabelsLayerProps,
    ...linkedHtmlElementsLayerProps,
    ...linkedObjectsLayerProps,
    ...linkedCustomLayerProps,
  },

  methods: {
    getGlobeRadius,
    getCoords: (_, ...args) => polar2Cartesian(...args),
    toGeoCoords: (_, ...args) => cartesian2Polar(...args),
    setPointOfView: (state, globalPov, globePos) => {
      let isBehindGlobe = undefined
      if (globalPov) {
        const globeRadius = getGlobeRadius()
        const pov = globePos ? globalPov.clone().sub(globePos) : globalPov // convert to local vector

        let povDist, povEdgeDist, povEdgeAngle, maxSurfacePosAngle
        isBehindGlobe = (pos) => {
          povDist === undefined && (povDist = pov.length())

          // check if it's behind plane of globe's visible area
          // maxSurfacePosAngle === undefined && (maxSurfacePosAngle = Math.acos(globeRadius / povDist));
          // return pov.angleTo(pos) > maxSurfacePosAngle;

          // more sophisticated method that checks also pos altitude
          povEdgeDist === undefined &&
            (povEdgeDist = Math.sqrt(povDist ** 2 - globeRadius ** 2))
          povEdgeAngle === undefined &&
            (povEdgeAngle = Math.acos(povEdgeDist / povDist))
          const povPosDist = pov.distanceTo(pos)
          if (povPosDist < povEdgeDist) return false // pos is closer than visible edge of globe

          const posDist = pos.length()
          const povPosAngle = Math.acos(
            (povDist ** 2 + povPosDist ** 2 - posDist ** 2) /
              (2 * povDist * povPosDist)
          ) // triangle solver
          return povPosAngle < povEdgeAngle // pos is within globe's visible area cone
        }
      }

      // pass behind globe checker for layers that need it
      state.layersThatNeedBehindGlobeChecker.forEach((l) =>
        l.isBehindGlobe(isBehindGlobe)
      )
    },
    ...linkedGlobeLayerMethods,
  },

  stateInit: () => {
    const layers = {
      globeLayer: GlobeLayerKapsule(),
      pathsLayer: PathsLayerKapsule(),
      labelsLayer: LabelsLayerKapsule(),
      htmlElementsLayer: HtmlElementsLayerKapsule(),
      objectsLayer: ObjectsLayerKapsule(),
      customLayer: CustomLayerKapsule(),
    }

    return {
      ...layers,
      layersThatNeedBehindGlobeChecker: Object.values(layers).filter((l) =>
        l.hasOwnProperty("isBehindGlobe")
      ),
    }
  },

  init(threeObj, state, { animateIn = true, waitForGlobeReady = true }) {
    // Clear the scene
    emptyObject(threeObj)

    // Main three object to manipulate
    threeObj.add((state.scene = new THREE.Group()))
    state.scene.visible = false // hide scene before globe initialization

    // Add all layers groups
    layers.forEach((layer) => {
      const g = new THREE.Group()
      state.scene.add(g)
      state[layer](g)
    })

    const initGlobe = () => {
      if (animateIn) {
        // Animate build-in just once
        state.scene.scale.set(1e-6, 1e-6, 1e-6)

        new TWEEN.Tween({ k: 1e-6 })
          .to({ k: 1 }, 600)
          .easing(TWEEN.Easing.Quadratic.Out)
          .onUpdate(({ k }) => state.scene.scale.set(k, k, k))
          .start()

        const rotAxis = new THREE.Vector3(0, 1, 0)
        new TWEEN.Tween({ rot: Math.PI * 2 })
          .to({ rot: 0 }, 1200)
          .easing(TWEEN.Easing.Quintic.Out)
          .onUpdate(({ rot }) =>
            state.scene.setRotationFromAxisAngle(rotAxis, rot)
          )
          .start()
      }

      state.scene.visible = true
      state.onGlobeReady && state.onGlobeReady()
    }

    waitForGlobeReady ? state.globeLayer.onReady(initGlobe) : initGlobe()

    // run tween updates
    ;(function onFrame() {
      requestAnimationFrame(onFrame)
      TWEEN.update()
    })() // IIFE
  },

  update(state) {},
})

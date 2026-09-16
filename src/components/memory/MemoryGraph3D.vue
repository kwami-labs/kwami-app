<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MemoryNode, MemoryGraph } from './types'
import { getNodeColor, calculateDegrees, findCentralNode, calculateNodeRadius, truncateText } from './utils'

const props = defineProps<{
  graph: MemoryGraph
  showEdgeLabels: boolean
  selectedNodeId: string | null
  linkingNodeId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-node', node: MemoryNode | null): void
  (e: 'link-start', node: MemoryNode): void
  (e: 'link-end', node: MemoryNode): void
  (e: 'link-cancel'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number
const nodeObjects: Map<string, THREE.Mesh> = new Map()
let edgeObjects: THREE.Line[] = []
const labelSprites: Map<string, THREE.Sprite> = new Map()
let edgeLabelSprites: THREE.Sprite[] = []
const positions3D: Map<string, THREE.Vector3> = new Map()
let nodeDegrees: Map<string, number> = new Map()
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let linkPreviewLine: THREE.Line | null = null

// Get CSS variable value
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Check if light mode
function isLightMode(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'light'
}

// Get theme-aware background color
function getSceneBgColor(): number {
  const opacity = parseFloat(getCSSVar('--glass-opacity')) || 0.88
  if (isLightMode()) {
    const base = Math.round(245 * opacity + 255 * (1 - opacity))
    return (base << 16) | (base << 8) | base
  } else {
    const base = Math.round(8 * opacity)
    return (base << 16) | ((base + 2) << 8) | (base + 10)
  }
}

// Gentle scale factor for graph size — just enough extra space for dense graphs
function graphScale(): number {
  const n = props.graph.nodes.length
  if (n <= 20) return 1
  // Logarithmic growth: 50 nodes → ~1.3x, 88 → ~1.5x, 200 → ~1.8x
  return 1 + Math.log10(n / 15) * 0.65
}

function initScene() {
  if (!containerRef.value) return
  
  cleanup()
  
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight || 500
  const scale = graphScale()

  scene = new THREE.Scene()
  scene.background = new THREE.Color(getSceneBgColor())

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 6000)
  camera.position.set(0, 40 * scale, 220 * scale)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  containerRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 50
  controls.maxDistance = 800 * scale * 2

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const pointLight = new THREE.PointLight(0xffffff, 1)
  pointLight.position.set(100, 100, 100)
  scene.add(pointLight)

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  renderer.domElement.addEventListener('click', onMouseClick)
  renderer.domElement.addEventListener('dblclick', onDoubleClick)
  renderer.domElement.addEventListener('mousemove', onMouseMove)
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('keydown', onKeyDown)

  animate()
}

function init3DLayout() {
  const nodes = props.graph.nodes
  const edges = props.graph.edges
  const scale = graphScale()
  
  positions3D.clear()
  nodeDegrees = calculateDegrees(nodes, edges)
  const centralNodeId = findCentralNode(nodeDegrees)
  
  const connectedToCentral = new Set<string>()
  edges.forEach(edge => {
    if (edge.source === centralNodeId) connectedToCentral.add(edge.target)
    if (edge.target === centralNodeId) connectedToCentral.add(edge.source)
  })
  
  // Scale radii based on graph density — keep nodes close to the hub
  const directRadius = 80 * scale
  const indirectRadius = 150 * scale
  let directAngle = 0
  let indirectAngle = 0
  const directAngleStep = (2 * Math.PI) / Math.max(connectedToCentral.size, 1)
  const indirectNodes = nodes.filter(n => n.id !== centralNodeId && !connectedToCentral.has(n.id))
  const indirectAngleStep = (2 * Math.PI) / Math.max(indirectNodes.length, 1)
  
  nodes.forEach(node => {
    if (node.id === centralNodeId) {
      positions3D.set(node.id, new THREE.Vector3(0, 0, 0))
    } else if (connectedToCentral.has(node.id)) {
      const phi = directAngle
      const theta = Math.PI / 2 + (Math.random() - 0.5) * 0.8
      positions3D.set(node.id, new THREE.Vector3(
        directRadius * Math.sin(theta) * Math.cos(phi),
        directRadius * Math.cos(theta),
        directRadius * Math.sin(theta) * Math.sin(phi)
      ))
      directAngle += directAngleStep
    } else {
      const phi = indirectAngle + Math.PI / 4
      const theta = Math.PI / 2 + (Math.random() - 0.5) * 1.2
      positions3D.set(node.id, new THREE.Vector3(
        indirectRadius * Math.sin(theta) * Math.cos(phi),
        indirectRadius * Math.cos(theta),
        indirectRadius * Math.sin(theta) * Math.sin(phi)
      ))
      indirectAngle += indirectAngleStep
    }
  })
  
  // Force-directed layout — scale parameters with graph size
  const iterations = Math.min(300 + nodes.length * 2, 600)
  const k = 0.15
  const baseRepulsion = 15000 * scale
  const minDistance = 40 + 15 * scale
  
  for (let i = 0; i < iterations; i++) {
    const cooling = 1 - (i / iterations) * 0.7
    
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const nodeA = nodes[a]
        const nodeB = nodes[b]
        if (!nodeA || !nodeB) continue
        
        const posA = positions3D.get(nodeA.id)!
        const posB = positions3D.get(nodeB.id)!
        
        const delta = new THREE.Vector3().subVectors(posA, posB)
        const dist = delta.length() || 1
        
        const degreeA = nodeDegrees.get(nodeA.id) || 1
        const degreeB = nodeDegrees.get(nodeB.id) || 1
        const degreeFactor = Math.sqrt(degreeA * degreeB) / 2 + 1
        
        const repulsion = baseRepulsion * degreeFactor
        let force = (repulsion / (dist * dist)) * cooling
        
        if (dist < minDistance) {
          force += (minDistance - dist) * 2 * cooling
        }
        
        delta.normalize().multiplyScalar(force)
        
        const isCentralA = nodeA.id === centralNodeId
        const isCentralB = nodeB.id === centralNodeId
        
        if (!isCentralA) posA.add(delta)
        if (!isCentralB) posB.sub(delta)
      }
    }
    
    edges.forEach(edge => {
      const posA = positions3D.get(edge.source)
      const posB = positions3D.get(edge.target)
      
      if (posA && posB) {
        const delta = new THREE.Vector3().subVectors(posB, posA)
        const dist = delta.length() || 1
        
        const degreeA = nodeDegrees.get(edge.source) || 1
        const degreeB = nodeDegrees.get(edge.target) || 1
        const targetLength = 45 * scale + Math.max(degreeA, degreeB) * 5
        
        const force = (dist - targetLength) * k * cooling
        delta.normalize().multiplyScalar(force)
        
        if (edge.source !== centralNodeId) posA.add(delta)
        if (edge.target !== centralNodeId) posB.sub(delta)
      }
    })
    
    if (i % 10 === 0) {
      const centerOfMass = new THREE.Vector3()
      let count = 0
      positions3D.forEach((pos, id) => {
        if (id !== centralNodeId) {
          centerOfMass.add(pos)
          count++
        }
      })
      if (count > 0) {
        centerOfMass.divideScalar(count)
        positions3D.forEach((pos, id) => {
          if (id !== centralNodeId) {
            pos.sub(centerOfMass.clone().multiplyScalar(0.1))
          }
        })
      }
    }
  }
}

function buildGraphObjects() {
  if (!scene) return
  
  nodeObjects.forEach(obj => scene.remove(obj))
  edgeObjects.forEach(obj => scene.remove(obj))
  labelSprites.forEach(sprite => scene.remove(sprite))
  edgeLabelSprites.forEach(sprite => scene.remove(sprite))
  nodeObjects.clear()
  edgeObjects = []
  labelSprites.clear()
  edgeLabelSprites = []
  
  const nodes = props.graph.nodes
  const edges = props.graph.edges
  
  let maxDegree = 1
  nodeDegrees.forEach(degree => {
    if (degree > maxDegree) maxDegree = degree
  })
  
  const edgeLabelPositions: THREE.Vector3[] = []
  
  // Reduce edge opacity for dense graphs to avoid spider-web effect
  const nodeCount = nodes.length
  const edgeOpacity = nodeCount > 80 ? 0.15 : nodeCount > 50 ? 0.25 : nodeCount > 30 ? 0.35 : 0.5
  const edgeColor = nodeCount > 50 ? 0x2d3a4c : 0x3d4a5c
  
  edges.forEach((edge, index) => {
    const startPos = positions3D.get(edge.source)
    const endPos = positions3D.get(edge.target)
    
    if (startPos && endPos) {
      const direction = new THREE.Vector3().subVectors(endPos, startPos)
      const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
      
      const perpendicular = new THREE.Vector3()
        .crossVectors(direction.normalize(), new THREE.Vector3(0, 1, 0))
      
      if (perpendicular.length() < 0.1) {
        perpendicular.crossVectors(direction, new THREE.Vector3(1, 0, 0))
      }
      
      perpendicular.normalize()
      const curveAmount = 8 + (index % 5) * 3
      midPoint.add(perpendicular.multiplyScalar(curveAmount))
      
      const curve = new THREE.QuadraticBezierCurve3(startPos.clone(), midPoint, endPos.clone())
      const points = curve.getPoints(20)
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({ 
        color: edgeColor, 
        opacity: edgeOpacity,
        transparent: true,
      })
      
      const line = new THREE.Line(geometry, material)
      scene.add(line)
      edgeObjects.push(line)
      
      const labelPos = curve.getPoint(0.5).clone()
      
      const offset = new THREE.Vector3(0, 0, 0)
      const labelSpacing = 15
      for (const existingPos of edgeLabelPositions) {
        const dist = labelPos.distanceTo(existingPos)
        if (dist < labelSpacing) {
          const pushDir = new THREE.Vector3().subVectors(labelPos, existingPos).normalize()
          offset.add(pushDir.multiplyScalar(labelSpacing - dist + 5))
        }
      }
      labelPos.add(offset)
      edgeLabelPositions.push(labelPos.clone())
      
      const relationLabel = truncateText(edge.relation, 20)
      const edgeLabelColor = isLightMode() ? 0x334155 : 0x8fa4bd
      const labelSprite = createTextSprite(relationLabel, edgeLabelColor, 0.7, 8, true)
      labelSprite.scale.multiplyScalar(graphScale())
      labelSprite.position.copy(labelPos)
      scene.add(labelSprite)
      edgeLabelSprites.push(labelSprite)
    }
  })
  
  nodes.forEach(node => {
    const pos = positions3D.get(node.id)
    if (!pos) return
    
    const degree = nodeDegrees.get(node.id) || 1
    const isUserNode = node.type === 'user' || node.id === 'user'
    const radius = calculateNodeRadius(degree, maxDegree, isUserNode)
    const degreeScale = Math.min(degree / maxDegree, 1)
    
    const color = getNodeColor(node.type)
    
    const geometry = new THREE.SphereGeometry(radius, 32, 32)
    const material = new THREE.MeshPhongMaterial({ 
      color,
      emissive: color,
      emissiveIntensity: props.selectedNodeId === node.id ? 0.8 : 0.3,
      shininess: 50
    })
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.copy(pos)
    ;(sphere as any).nodeData = node
    ;(sphere as any).nodeRadius = radius
    scene.add(sphere)
    nodeObjects.set(node.id, sphere)
    
    const glowGeometry = new THREE.SphereGeometry(radius * 1.4, 16, 16)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12 + degreeScale * 0.08
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.copy(pos)
    scene.add(glow)
    
    const maxLabelLength = degree > 3 ? 20 : 14
    const label = truncateText(node.label, maxLabelLength)
    const fontSize = 10 + Math.floor(degreeScale * 4)
    const nodeLabelColor = isLightMode() ? 0x0f172a : 0xe2e8f0
    const labelSprite = createTextSprite(label, nodeLabelColor, 1, fontSize)
    // Scale labels up proportionally to camera distance so they stay readable
    const scale = graphScale()
    labelSprite.scale.multiplyScalar(scale)
    labelSprite.position.copy(pos)
    labelSprite.position.y -= radius + 10 * scale + radius * 0.3
    scene.add(labelSprite)
    labelSprites.set(node.id, labelSprite)
  })
  
  updateEdgeLabelVisibility()
}

function createTextSprite(
  text: string, 
  color: number, 
  opacity: number = 1, 
  fontSize: number = 14,
  isEdgeLabel: boolean = false
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  
  const scale = 2
  canvas.width = 512 * scale
  canvas.height = 64 * scale
  
  const actualFontSize = fontSize * 3 * scale
  
  context.font = `${isEdgeLabel ? '500' : 'bold'} ${actualFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  
  const metrics = context.measureText(text)
  const textWidth = metrics.width
  const textHeight = actualFontSize
  
  context.clearRect(0, 0, canvas.width, canvas.height)
  
  const lightMode = isLightMode()
  
  if (isEdgeLabel) {
    const padding = 12 * scale
    const bgWidth = textWidth + padding * 2
    const bgHeight = textHeight + padding
    const bgX = (canvas.width - bgWidth) / 2
    const bgY = (canvas.height - bgHeight) / 2
    const radius = 6 * scale
    
    context.fillStyle = lightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(13, 17, 23, 0.85)'
    context.beginPath()
    if (context.roundRect) {
      context.roundRect(bgX, bgY, bgWidth, bgHeight, radius)
    } else {
      context.moveTo(bgX + radius, bgY)
      context.lineTo(bgX + bgWidth - radius, bgY)
      context.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius)
      context.lineTo(bgX + bgWidth, bgY + bgHeight - radius)
      context.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - radius, bgY + bgHeight)
      context.lineTo(bgX + radius, bgY + bgHeight)
      context.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius)
      context.lineTo(bgX, bgY + radius)
      context.quadraticCurveTo(bgX, bgY, bgX + radius, bgY)
      context.closePath()
    }
    context.fill()
  }
  
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  
  context.shadowColor = lightMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  context.shadowBlur = 6 * scale
  context.shadowOffsetX = 1 * scale
  context.shadowOffsetY = 1 * scale
  
  // Use darker version of color in light mode for better readability
  if (lightMode && !isEdgeLabel) {
    // Darken the color for light mode
    const r = Math.max(0, ((color >> 16) & 0xff) - 60)
    const g = Math.max(0, ((color >> 8) & 0xff) - 60)
    const b = Math.max(0, (color & 0xff) - 60)
    context.fillStyle = `rgb(${r}, ${g}, ${b})`
  } else {
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`
  }
  context.fillText(text, canvas.width / 2, canvas.height / 2)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  
  const material = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    opacity,
    depthTest: false,
    sizeAttenuation: true
  })
  
  const sprite = new THREE.Sprite(material)
  
  const baseScale = isEdgeLabel ? 35 : 45
  const aspectRatio = canvas.width / canvas.height
  sprite.scale.set(baseScale * aspectRatio * 0.5, baseScale * 0.5, 1)
  
  return sprite
}

function hitTestNode(event: MouseEvent): MemoryNode | null {
  if (!containerRef.value) return null
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const meshes = Array.from(nodeObjects.values())
  const intersects = raycaster.intersectObjects(meshes)
  if (intersects.length > 0) {
    return (intersects[0]!.object as any).nodeData as MemoryNode || null
  }
  return null
}

function onMouseClick(event: MouseEvent) {
  const node = hitTestNode(event)

  // If we're in linking mode, a click completes the link
  if (props.linkingNodeId) {
    if (node && node.id !== props.linkingNodeId) {
      emit('link-end', node)
    } else if (!node) {
      // Clicked empty space -- cancel linking
      emit('link-cancel')
    }
    return
  }

  // Normal selection
  if (node) {
    emit('select-node', node)
    nodeObjects.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshPhongMaterial
      mat.emissiveIntensity = id === node.id ? 0.8 : 0.3
    })
  } else {
    emit('select-node', null)
    nodeObjects.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshPhongMaterial
      mat.emissiveIntensity = 0.3
    })
  }
}

function onDoubleClick(event: MouseEvent) {
  const node = hitTestNode(event)
  if (node) {
    emit('link-start', node)
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.linkingNodeId) {
    emit('link-cancel')
  }
}

function onMouseMove(event: MouseEvent) {
  if (!containerRef.value || !renderer) return
  
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  
  const meshes = Array.from(nodeObjects.values())
  const intersects = raycaster.intersectObjects(meshes)

  // Update cursor based on linking mode
  if (props.linkingNodeId) {
    renderer.domElement.style.cursor = intersects.length > 0 ? 'cell' : 'crosshair'
  } else {
    renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab'
  }

  // Update link preview line
  updateLinkPreview()
}

function updateLinkPreview() {
  // Remove old preview
  if (linkPreviewLine && scene) {
    scene.remove(linkPreviewLine)
    linkPreviewLine.geometry.dispose()
    ;(linkPreviewLine.material as THREE.Material).dispose()
    linkPreviewLine = null
  }

  if (!props.linkingNodeId || !scene || !camera) return

  const sourcePos = positions3D.get(props.linkingNodeId)
  if (!sourcePos) return

  // Project mouse into 3D space on a plane facing the camera
  raycaster.setFromCamera(mouse, camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), 0)
  plane.constant = -sourcePos.dot(plane.normal)
  const targetPos = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, targetPos)
  if (!targetPos) return

  // Check if hovering over a node -- snap to it
  const meshes = Array.from(nodeObjects.values())
  const intersects = raycaster.intersectObjects(meshes)
  if (intersects.length > 0) {
    const hoveredNode = (intersects[0]!.object as any).nodeData as MemoryNode
    if (hoveredNode && hoveredNode.id !== props.linkingNodeId) {
      const snapPos = positions3D.get(hoveredNode.id)
      if (snapPos) targetPos.copy(snapPos)
    }
  }

  const points = [sourcePos.clone(), targetPos]
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineDashedMaterial({
    color: 0x00d9ff,
    dashSize: 6,
    gapSize: 4,
    opacity: 0.7,
    transparent: true,
  })
  linkPreviewLine = new THREE.Line(geometry, material)
  linkPreviewLine.computeLineDistances()
  scene.add(linkPreviewLine)
}

function onWindowResize() {
  if (!containerRef.value || !camera || !renderer) return
  
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight || 500
  
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function updateEdgeLabelVisibility() {
  if (!camera) return
  
  const cameraDistance = camera.position.length()
  const scale = graphScale()
  const fadeStart = 350 * scale
  const fadeEnd = 500 * scale
  
  // Edge labels
  edgeLabelSprites.forEach(sprite => {
    if (props.showEdgeLabels && cameraDistance < fadeEnd) {
      const opacity = cameraDistance < fadeStart 
        ? 0.6 
        : 0.6 * (1 - (cameraDistance - fadeStart) / (fadeEnd - fadeStart))
      ;(sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, opacity)
      sprite.visible = opacity > 0.05
    } else {
      sprite.visible = false
    }
  })
  
  // Node labels — only fade when zoomed very far out
  if (labelSprites.size === 0) return
  const nodeCount = props.graph.nodes.length
  
  if (nodeCount > 40) {
    // Only start fading labels at 2x the default camera distance
    const defaultCamDist = Math.sqrt((50 * scale) ** 2 + (280 * scale) ** 2)
    const labelFadeStart = defaultCamDist * 2
    const labelFadeEnd = defaultCamDist * 3.5
    
    labelSprites.forEach((sprite, nodeId) => {
      if (cameraDistance < labelFadeStart) {
        // Normal zoom — all labels fully visible
        ;(sprite.material as THREE.SpriteMaterial).opacity = 1
        sprite.visible = true
      } else if (cameraDistance < labelFadeEnd) {
        const t = (cameraDistance - labelFadeStart) / (labelFadeEnd - labelFadeStart)
        const degree = nodeDegrees.get(nodeId) || 0
        const degreeBonus = Math.min(degree / 8, 0.4)
        const opacity = Math.max(0, 1 - t + degreeBonus)
        ;(sprite.material as THREE.SpriteMaterial).opacity = Math.max(0.05, opacity)
        sprite.visible = opacity > 0.05
      } else {
        // Very far zoom — only show high-degree labels
        const degree = nodeDegrees.get(nodeId) || 0
        sprite.visible = degree >= 5
        if (sprite.visible) {
          ;(sprite.material as THREE.SpriteMaterial).opacity = 0.5
        }
      }
    })
  }
}

function animate() {
  animationId = requestAnimationFrame(animate)
  
  if (controls) controls.update()
  updateEdgeLabelVisibility()
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

function cleanup() {
  if (animationId) cancelAnimationFrame(animationId)
  if (linkPreviewLine && scene) {
    scene.remove(linkPreviewLine)
    linkPreviewLine = null
  }
  if (renderer) {
    renderer.domElement.removeEventListener('click', onMouseClick)
    renderer.domElement.removeEventListener('dblclick', onDoubleClick)
    renderer.domElement.removeEventListener('mousemove', onMouseMove)
    renderer.dispose()
    if (renderer.domElement.parentNode === containerRef.value) {
      containerRef.value?.removeChild(renderer.domElement)
    }
  }
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onKeyDown)
  nodeObjects.clear()
  labelSprites.clear()
  edgeObjects = []
  edgeLabelSprites = []
}

function rebuild() {
  if (props.graph.nodes.length > 0) {
    initScene()
    init3DLayout()
    buildGraphObjects()
  }
}

onMounted(rebuild)

watch(() => props.graph, rebuild, { deep: true })

watch(() => props.showEdgeLabels, updateEdgeLabelVisibility)

watch(() => props.selectedNodeId, (newId) => {
  nodeObjects.forEach((mesh, id) => {
    const mat = mesh.material as THREE.MeshPhongMaterial
    mat.emissiveIntensity = id === newId ? 0.8 : 0.3
  })
})

// Highlight linking source node with a pulsing glow
watch(() => props.linkingNodeId, (newId, oldId) => {
  // Reset old source
  if (oldId) {
    const mesh = nodeObjects.get(oldId)
    if (mesh) {
      const mat = mesh.material as THREE.MeshPhongMaterial
      mat.emissiveIntensity = 0.3
    }
  }
  // Highlight new source
  if (newId) {
    const mesh = nodeObjects.get(newId)
    if (mesh) {
      const mat = mesh.material as THREE.MeshPhongMaterial
      mat.emissiveIntensity = 1.0
    }
  }
  // Remove preview line when linking is cancelled
  if (!newId && linkPreviewLine && scene) {
    scene.remove(linkPreviewLine)
    linkPreviewLine.geometry.dispose()
    ;(linkPreviewLine.material as THREE.Material).dispose()
    linkPreviewLine = null
  }
})

onUnmounted(cleanup)
</script>

<template>
  <div ref="containerRef" class="graph-3d-container"></div>
</template>

<style scoped>
.graph-3d-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
}
</style>

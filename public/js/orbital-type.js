/**
 * Ghani University - 3D Desktop World Globe (Orbital Type)
 * Realistic Tilted Office Tabletop World Globe with Spinning University Latitude Ribbons
 * 
 * Features:
 * - 23.4° Axial Tilt (Authentic Office Tabletop Globe Angle)
 * - 9 Full Latitude Rings of Large, Bold University Text (North Pole to Equator to South Pole)
 * - Large, crisp, bold font (15px-19px with perspective depth)
 * - Metallic Meridian Stand Arc & Pedestal Base (Authentic Office Desk Globe Mount)
 * - Glossy 3D World Sphere Core with Ambient Depth, Fresnel Rim Glow & Specular Light
 * - Faint Longitude Meridian Arcs rotating with the planet
 * - Central Luminous University Emblem ("GU • EST. 2026")
 * - Natural Forward Left-to-Right English Text Reading
 * - Fluid Touch & Mouse Drag Interaction with Momentum Physics
 */

(function () {
  'use strict';

  class DesktopWorldGlobe {
    constructor(canvasId, options = {}) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      // Core Physical Dimensions
      this.radius = options.radius || 126;
      this.baseFontSize = options.fontSize || 14.5;
      this.centerEmblem = options.centerEmblem !== false;

      // Earth / Desk Globe 23.4° Axial Tilt (leaning to upper-right)
      this.axialTilt = (-23.4 * Math.PI) / 180;
      this.cosTilt = Math.cos(this.axialTilt);
      this.sinTilt = Math.sin(this.axialTilt);

      // 3D Viewing State
      this.yaw = 0.0;
      this.pitch = (10 * Math.PI) / 180; // Gentle elevated view
      this.yawSpeed = 0.0055; // Smooth forward rotation glide
      this.pitchSpeed = 0.0003;
      this.focalLength = 360;

      // Mouse / Touch Interaction (Spin by hand)
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.dragVelocityX = 0;
      this.dragVelocityY = 0;
      this.dampening = 0.94;

      // 9 Full Latitude Text Rings (from North Polar Region down to South Polar Region)
      // All text strictly Ghani University & Sheikhupura
      this.latitudeRings = [
        { phiDeg: 62,  text: 'GHANI UNIVERSITY • ' },
        { phiDeg: 46,  text: 'GHANI UNIVERSITY • EST. 2026 • ' },
        { phiDeg: 30,  text: 'GHANI UNIVERSITY SHEIKHUPURA • ' },
        { phiDeg: 15,  text: 'GHANI UNIVERSITY • SHEIKHUPURA • ' },
        { phiDeg: 0,   text: 'GHANI UNIVERSITY SHEIKHUPURA • ', isEquator: true },
        { phiDeg: -15, text: 'GHANI UNIVERSITY • SHEIKHUPURA • ' },
        { phiDeg: -30, text: 'GHANI UNIVERSITY SHEIKHUPURA • ' },
        { phiDeg: -46, text: 'GHANI UNIVERSITY • EST. 2026 • ' },
        { phiDeg: -62, text: 'GHANI UNIVERSITY • ' }
      ];

      // Longitude Meridian Arcs (6 rotating meridians around the globe)
      this.meridianCount = 6;

      this.setupCanvas();
      this.initEvents();
      this.animate();
    }

    setupCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.width = rect.width || 360;
      this.height = rect.height || 360;

      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.centerX = this.width / 2;
      this.centerY = this.height / 2;
    }

    initEvents() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const onStart = (e) => {
        this.isDragging = true;
        const pos = getPos(e);
        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
        this.dragVelocityX = 0;
        this.dragVelocityY = 0;
        this.canvas.style.cursor = 'grabbing';
      };

      const onMove = (e) => {
        if (!this.isDragging) return;
        const pos = getPos(e);
        const dx = pos.x - this.lastMouseX;
        const dy = pos.y - this.lastMouseY;

        this.dragVelocityX = dx * 0.007;
        this.dragVelocityY = dy * 0.007;

        // Spin around polar axis
        this.yaw -= this.dragVelocityX;
        this.pitch -= this.dragVelocityY * 0.4;

        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
      };

      const onEnd = () => {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
      };

      this.canvas.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);

      window.addEventListener('resize', () => this.setupCanvas());
    }

    /**
     * 3D Point Projector:
     * Transforms local point on/around the globe to screen space with Axial Tilt & Viewer Pitch
     */
    project(xLoc, yLoc, zLoc) {
      // 1. Apply Axial Tilt (23.4° around Z axis)
      const xT = xLoc * this.cosTilt - yLoc * this.sinTilt;
      const yT = xLoc * this.sinTilt + yLoc * this.cosTilt;
      const zT = zLoc;

      // 2. Apply Viewer Pitch (around X axis)
      const cosP = Math.cos(this.pitch);
      const sinP = Math.sin(this.pitch);
      const x3 = xT;
      const y3 = yT * cosP - zT * sinP;
      const z3 = yT * sinP + zT * cosP;

      // 3. Perspective Projection (Screen Y is inverted: +Y is UP)
      const scale = this.focalLength / (this.focalLength + z3);
      const screenX = this.centerX + x3 * scale;
      const screenY = this.centerY - y3 * scale;

      return { x: screenX, y: screenY, z: z3, scale };
    }

    /**
     * Draw the Classic Metallic Meridian Stand & Pedestal Base (Tabletop World Globe)
     */
    drawDeskGlobeStand() {
      const standRadius = this.radius * 1.15;
      const poleArmRadius = this.radius * 1.09;

      // North Pole and South Pole spindle pins
      const northPin = this.project(0, poleArmRadius, 0);
      const southPin = this.project(0, -poleArmRadius, 0);

      // Semi-circular Meridian Arc (Left-side support ring holding the globe)
      this.ctx.save();

      // Draw South Base Pedestal Mount
      const baseStem = this.project(-standRadius * 0.45, -standRadius * 0.95, 0);
      const baseFootL = this.project(-standRadius * 0.70, -standRadius * 1.12, 0);
      const baseFootR = this.project(-standRadius * 0.20, -standRadius * 1.12, 0);

      // Base Pedestal
      const baseGrad = this.ctx.createLinearGradient(baseFootL.x, baseFootL.y, baseFootR.x, baseFootR.y);
      baseGrad.addColorStop(0, 'rgba(30, 58, 138, 0.40)');
      baseGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.75)');
      baseGrad.addColorStop(1, 'rgba(14, 116, 144, 0.40)');

      this.ctx.strokeStyle = baseGrad;
      this.ctx.lineWidth = 3.5;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(baseFootL.x, baseFootL.y);
      this.ctx.lineTo(baseStem.x, baseStem.y);
      this.ctx.lineTo(baseFootR.x, baseFootR.y);
      this.ctx.stroke();

      // Semi-circle Meridian Gimbal Arc (running from North Pole to South Pole along the west flank)
      const arcSteps = 32;
      this.ctx.beginPath();
      for (let s = 0; s <= arcSteps; s++) {
        // Angle along meridian semi-circle from North pole (+PI/2) to South pole (-PI/2) on the left (-X)
        const a = (Math.PI / 2) - (s / arcSteps) * Math.PI;
        const xLoc = -standRadius * Math.cos(a);
        const yLoc = standRadius * Math.sin(a);
        const pt = this.project(xLoc, yLoc, 0);

        if (s === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      }

      this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Outer metallic highlight for meridian ring
      this.ctx.strokeStyle = 'rgba(147, 197, 253, 0.65)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();

      // North Pole Spindle Pin
      this.ctx.fillStyle = '#93C5FD';
      this.ctx.shadowColor = '#3B82F6';
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(northPin.x, northPin.y, 3.5 * northPin.scale, 0, Math.PI * 2);
      this.ctx.fill();

      // South Pole Spindle Pin
      this.ctx.beginPath();
      this.ctx.arc(southPin.x, southPin.y, 3.5 * southPin.scale, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }

    /**
     * Draw 3D Spherical Atmosphere Body & Faint Rotating Longitude Meridians
     */
    drawGlobeSphere() {
      // 1. Spherical Body Radial Glow (Deep ocean / planetary sphere)
      const sphereGrad = this.ctx.createRadialGradient(
        this.centerX - this.radius * 0.28, this.centerY - this.radius * 0.28, 15,
        this.centerX, this.centerY, this.radius
      );
      sphereGrad.addColorStop(0, 'rgba(59, 130, 246, 0.25)'); // Specular highlight quadrant
      sphereGrad.addColorStop(0.4, 'rgba(30, 58, 138, 0.20)'); // Deep oceanic body
      sphereGrad.addColorStop(0.85, 'rgba(15, 23, 42, 0.35)'); // Shaded terminator
      sphereGrad.addColorStop(1, 'rgba(13, 148, 136, 0.18)'); // Atmospheric limb glow

      this.ctx.save();
      this.ctx.fillStyle = sphereGrad;
      this.ctx.beginPath();
      this.ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Thin atmospheric rim circle
      this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.restore();

      // 2. Faint Longitude Meridian Arcs (Connecting North & South Poles)
      this.ctx.save();
      for (let m = 0; m < this.meridianCount; m++) {
        const meridianLong = (m / this.meridianCount) * Math.PI - this.yaw;
        const steps = 24;

        this.ctx.beginPath();
        let hasVisible = false;

        for (let s = 0; s <= steps; s++) {
          const lat = (Math.PI / 2) - (s / steps) * Math.PI;
          const rLat = this.radius * Math.cos(lat);
          const yLat = this.radius * Math.sin(lat);
          const xLat = rLat * Math.sin(meridianLong);
          const zLat = rLat * Math.cos(meridianLong);

          const pt = this.project(xLat, yLat, zLat);
          if (pt.z > -20) {
            if (!hasVisible) {
              this.ctx.moveTo(pt.x, pt.y);
              hasVisible = true;
            } else {
              this.ctx.lineTo(pt.x, pt.y);
            }
          } else {
            hasVisible = false;
          }
        }

        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    render() {
      // Dynamic resize check
      const currentWidth = this.canvas.clientWidth;
      const currentHeight = this.canvas.clientHeight;
      if (currentWidth > 20 && (Math.abs(currentWidth - this.width) > 2 || Math.abs(currentHeight - this.height) > 2)) {
        this.setupCanvas();
      }

      this.ctx.clearRect(0, 0, this.width, this.height);

      // Inertia update
      if (!this.isDragging) {
        this.yaw += this.yawSpeed - this.dragVelocityX;
        this.pitch += this.pitchSpeed + this.dragVelocityY;
        this.dragVelocityX *= this.dampening;
        this.dragVelocityY *= this.dampening;
      }

      // Constrain vertical pitch so globe remains naturally viewable
      this.pitch = Math.max(-0.45, Math.min(0.55, this.pitch));

      // 1. Draw Desk Globe Meridian Stand Arc & Base
      this.drawDeskGlobeStand();

      // 2. Draw 3D Globe Spherical Body
      this.drawGlobeSphere();

      // 3. Collect all 3D Text Characters across all 9 Latitude Rings
      const particles = [];

      this.latitudeRings.forEach((ring, rIdx) => {
        const phi = (ring.phiDeg * Math.PI) / 180;
        const ringRadius = this.radius * Math.cos(phi);
        const ringY = this.radius * Math.sin(phi);

        const text = ring.text;
        const count = text.length;

        for (let i = 0; i < count; i++) {
          const char = text[i];
          // Natural Left-to-Right English text flow around the globe:
          const lambda = (i / count) * Math.PI * 2 - this.yaw;

          const xLoc = ringRadius * Math.sin(lambda);
          const yLoc = ringY;
          const zLoc = ringRadius * Math.cos(lambda);

          const pt = this.project(xLoc, yLoc, zLoc);

          particles.push({
            char,
            x: pt.x,
            y: pt.y,
            z: pt.z,
            scale: pt.scale,
            isEquator: !!ring.isEquator,
            ringIndex: rIdx
          });
        }
      });

      // Sort by depth (back to front for 3D realism)
      particles.sort((a, b) => a.z - b.z);

      // 4. Render Depth-Sorted Characters with Large, Crisp Typography
      particles.forEach((p) => {
        const isFront = p.z > -10;
        const depthNorm = Math.max(0, Math.min(1, (p.z + this.radius) / (this.radius * 2)));
        const alpha = Math.max(0.14, Math.min(1.0, 0.22 + depthNorm * 0.78));

        // Enlarge font size: Equator is largest and most prominent
        const sizeMult = p.isEquator ? 1.15 : (p.ringIndex === 3 || p.ringIndex === 5 ? 1.05 : 0.95);
        const effectiveSize = Math.round(this.baseFontSize * sizeMult * p.scale);

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.font = `900 ${effectiveSize}px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (isFront) {
          // Front characters: Ultra-bold, brilliant pure white & sky-blue with neon glow
          if (depthNorm > 0.65) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.shadowColor = 'rgba(59, 130, 246, 0.95)';
            this.ctx.shadowBlur = 10 * p.scale;
          } else {
            this.ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`;
            this.ctx.shadowColor = 'rgba(59, 130, 246, 0.85)';
            this.ctx.shadowBlur = 8 * p.scale;
          }
        } else {
          // Rear characters: Subdued navy fading gracefully behind the globe
          this.ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.32})`;
          this.ctx.shadowBlur = 0;
        }

        this.ctx.fillText(p.char, 0, 0);
        this.ctx.restore();
      });

      // 5. Draw Center University Emblem in the core of the globe
      if (this.centerEmblem) {
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Luminous GU Core Text
        this.ctx.font = '900 24px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.shadowColor = 'rgba(59, 130, 246, 0.95)';
        this.ctx.shadowBlur = 16;
        this.ctx.fillText('GU', this.centerX, this.centerY - 2);

        // Core Subtitle
        this.ctx.font = '800 9px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(147, 197, 253, 0.90)';
        this.ctx.shadowBlur = 6;
        this.ctx.fillText('EST. 2026', this.centerX, this.centerY + 16);
        this.ctx.restore();
      }
    }

    animate() {
      this.render();
      requestAnimationFrame(() => this.animate());
    }
  }

  window.DesktopWorldGlobe = DesktopWorldGlobe;
  window.OrbitalType = DesktopWorldGlobe; // Backward compatibility

  // Auto-initialize across Student, Teacher, and Admin portals
  function initAllWorldGlobes() {
    const ids = ['orbital-type-canvas', 'orbital-type-canvas-teacher', 'orbital-type-canvas-admin'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._orbitalInstance) {
        el._orbitalInstance = new DesktopWorldGlobe(id, {
          radius: 126,
          fontSize: 14.5
        });
      }
    });

    document.querySelectorAll('.orbital-type-canvas').forEach(el => {
      if (el && !el._orbitalInstance) {
        if (!el.id) el.id = 'orbital-canvas-' + Math.random().toString(36).substring(2, 9);
        el._orbitalInstance = new DesktopWorldGlobe(el.id, {
          radius: 126,
          fontSize: 14.5
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllWorldGlobes);
  } else {
    initAllWorldGlobes();
  }
})();

'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

interface BasketballLoaderProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function BasketballLoader({ 
  size = 'md', 
  text = 'Loading...', 
  className = '' 
}: BasketballLoaderProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  
  const sizeMap = {
    sm: { width: 120, height: 90 },
    md: { width: 200, height: 150 },
    lg: { width: 280, height: 210 },
  }
  
  const { width, height } = sizeMap[size]
  
  useEffect(() => {
    if (!svgRef.current) return
    
    const svg = svgRef.current
    const ball = svg.querySelector('#ball')
    const shineBounce = svg.querySelector('#shineBounce')
    const startPaths = svg.querySelectorAll('.startPath')
    
    if (!ball) return
    
    // Make SVG visible
    gsap.set(svg, { visibility: 'visible' })
    
    // Get ball properties
    const getBallProp = gsap.getProperty(ball)
    
    // Rotate shine with ball
    const rotateShine = () => {
      if (shineBounce) {
        gsap.set(shineBounce, {
          x: getBallProp('x') as number,
          y: getBallProp('y') as number,
          rotation: 42,
          transformOrigin: '50% 50%'
        })
      }
    }
    
    // Create timeline
    const tl = gsap.timeline({ paused: false, onUpdate: rotateShine })
    tlRef.current = tl
    
    // Ball rotation animation
    tl.to(ball, {
      rotation: `-=${gsap.utils.random(-360, 360)}`,
      duration: 2,
      repeat: -1,
      ease: 'sine.in',
      repeatRefresh: true,
      transformOrigin: '50% 50%'
    }, 0)
    
    // Ball and shine scale animation (bounce effect)
    tl.fromTo([ball, svg.querySelector('#ballGradShadow'), svg.querySelector('#ballGradShine')], {
      scale: 1.5,
      transformOrigin: '50% 50%',
    }, {
      duration: 0.5,
      transformOrigin: '50% 50%',
      scale: 0.85,
      repeat: -1,
      yoyo: true,
      ease: 'power1.in'
    }, 0)
    
    // Animate ball path seams
    startPaths.forEach((path, i) => {
      tl.to(path, {
        strokeDashoffset: -100,
        duration: 0.8,
        repeat: -1,
        ease: 'none',
        delay: i * 0.2
      }, 0)
    })
    
    // Seek to a good starting point
    tl.seek(100)
    
    return () => {
      if (tlRef.current) {
        tlRef.current.kill()
      }
    }
  }, [])
  
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <svg 
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 800 600"
        width={width}
        height={height}
        style={{ visibility: 'hidden' }}
      >
        <defs>
          {/* Ball shine gradient - basketball orange */}
          <radialGradient id="ballShineGrad" cx="400" cy="286.7" fx="400" fy="286.7" r="80" gradientTransform="translate(827.84 183.02) rotate(136.27) scale(1 .8)" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff"/>
            <stop offset=".05" stopColor="#fefaf5" stopOpacity=".99"/>
            <stop offset=".09" stopColor="#fdebd0" stopOpacity=".95"/>
            <stop offset=".12" stopColor="#fcd5a0" stopOpacity=".89"/>
            <stop offset=".15" stopColor="#fabf70" stopOpacity=".8"/>
            <stop offset=".18" stopColor="#f8a840" stopOpacity=".69"/>
            <stop offset=".21" stopColor="#f59020" stopOpacity=".55"/>
            <stop offset=".23" stopColor="#f07810" stopOpacity=".39"/>
            <stop offset=".26" stopColor="#e86008" stopOpacity=".2"/>
          </radialGradient>
          
          {/* Ball gradient - orange tones */}
          <radialGradient id="ballGrad1" cx="397.53" cy="295.98" fx="397.53" fy="295.98" r="47.04" gradientUnits="userSpaceOnUse">
            <stop offset=".62" stopColor="#c44a10" stopOpacity=".19"/>
            <stop offset=".78" stopColor="#5c2300" stopOpacity=".61"/>
            <stop offset="1" stopColor="#1a0800" stopOpacity=".81"/>
          </radialGradient>
          
          {/* Net gradient */}
          <linearGradient id="netGrad" x1="400" y1="200" x2="400" y2="280" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFE8E0"/>
            <stop offset="1" stopColor="#ccc"/>
          </linearGradient>
        </defs>
        
        {/* Net - simplified white/cream color */}
        <g id="net" opacity="0.7">
          <path d="m449.66,218.35l3.45,2.08.07.04c.82.49,1.19,1.44.98,2.32l-8.37,36.01v.05c-.18.73-.84,1.21-1.56,1.17l-17.45-.87,1.19-1.7,4.98,13.04v.03c.21.51-.05,1.08-.56,1.27-.19.07-.39.08-.58.04l-11.21-2.68.86-1.15,5.12,9.71v.02c.17.3.05.66-.24.82-.15.08-.33.09-.48.04l-9.07-3.11c-.24-.08-.36-.34-.28-.58.08-.23.33-.36.56-.29l9.17,2.81-.72.87-5.43-9.54c-.21-.38-.08-.85.29-1.07.17-.1.36-.12.54-.09h.03s11.3,2.29,11.3,2.29l-1.13,1.34-5.44-12.86c-.26-.62.03-1.34.65-1.61.16-.07.33-.1.49-.1h.05s17.47.26,17.47.26l-1.56,1.22,7.1-36.28,1.05,2.36-3.53-1.95c-1.1-.61-1.49-1.99-.89-3.09s1.99-1.49,3.09-.89c.02.01.05.03.07.04Z" fill="url(#netGrad)"/>
          <path d="m447.39,222.28l-3.45-2.08,2.57-.27-27.87,24.28.28-1.96,8.96,15,.02.04c.35.58.16,1.33-.42,1.68-.16.1-.34.15-.52.17l-14.51,1.33.61-1.67,8.29,9.03.02.02c.29.32.27.81-.05,1.11-.15.14-.33.2-.52.21l-10.12.12.42-1.04,6.15,6.48c.17.18.17.47-.02.64-.18.17-.46.16-.63,0l-6.38-6.26c-.24-.23-.24-.62,0-.86.11-.11.26-.17.4-.18h.02s10.11-.48,10.11-.48l-.55,1.33-8.59-8.75c-.38-.39-.38-1.01.01-1.4.16-.16.36-.25.57-.27h.03s14.46-1.82,14.46-1.82l-.92,1.89-9.48-14.68c-.4-.63-.29-1.44.24-1.93l.04-.04,27-25.25c.7-.65,1.71-.75,2.5-.31l.07.04,3.53,1.95c1.1.61,1.49,1.99.89,3.09-.61,1.1-1.99,1.49-3.09.89-.02-.01-.05-.03-.07-.04Z" fill="url(#netGrad)"/>
          <path d="m353.14,384.82l-3.45-2.08-.07-.04c-.82-.49-1.19-1.44-.98-2.32l8.37-36.01v-.05c.18-.73.84-1.21,1.56-1.17l17.45.87-1.19,1.7-4.98-13.04v-.03c-.21-.51.05-1.08.56-1.27.19-.07.39-.08.58-.04l11.21,2.68-.86,1.15-5.12-9.71v-.02c-.17-.3-.05-.66.24-.82.15-.08.33-.09.48-.04l9.07,3.11c.24.08.36.34.28.58-.08.23-.33.36-.56.29l-9.17-2.81.72-.87,5.43,9.54c.21.38.08.85-.29,1.07-.17.1-.36.12-.54.09h-.03s-11.3-2.29-11.3-2.29l1.13-1.34,5.44,12.86c.26.62-.03,1.34-.65,1.61-.16.07-.33.1-.49.1h-.05s-17.47-.26-17.47-.26l1.56-1.22-7.1,36.28-1.05-2.36,3.53,1.95c1.1.61,1.49,1.99.89,3.09s-1.99,1.49-3.09.89c-.02-.01-.05-.03-.07-.04Z" fill="url(#netGrad)"/>
          <path d="m355.41,380.89l3.45,2.08-2.57.27,27.87-24.28-.28,1.96-8.96-15-.02-.04c-.35-.58-.16-1.33.42-1.68.16-.1.34-.15.52-.17l14.51-1.33-.61,1.67-8.29-9.03-.02-.02c-.29-.32-.27-.81.05-1.11.15-.14.33-.2.52-.21l10.12-.12-.42,1.04-6.15-6.48c-.17-.18-.17-.47.02-.64.18-.17.46-.16.63,0l6.38,6.26c.24.23.24.62,0,.86-.11.11-.26.17-.4.18h-.02s-10.11.48-10.11.48l.55-1.33,8.59,8.75c.38.39.38,1.01-.01,1.4-.16.16-.36.25-.57.27h-.03s-14.46,1.82-14.46,1.82l.92-1.89,9.48,14.68c.4.63.29,1.44-.24,1.93l-.04.04-27,25.25c-.7.65-1.71.75-2.5.31l-.07-.04-3.53-1.95c-1.1-.61-1.49-1.99-.89-3.09.61-1.1,1.99-1.49,3.09-.89.02.01.05.03.07.04Z" fill="url(#netGrad)"/>
        </g>
        
        {/* Ring/Rim - Basketball orange/red color */}
        <g id="ringOuter">
          <circle cx="400.93" cy="300.93" r="95.31" fill="none" stroke="#E35D22" strokeMiterlimit="10" strokeWidth="9.08"/>
          <circle cx="400" cy="300" r="95.31" fill="none" opacity=".5" stroke="#FF6B35" strokeMiterlimit="10" strokeWidth="3.68"/>
          <circle cx="399.07" cy="299.07" r="95.31" fill="none" opacity=".4" stroke="#FFB898" strokeMiterlimit="10" strokeWidth=".76"/>
        </g>
        
        {/* Basketball */}
        <g id="ball">
          <circle cx="400" cy="300" r="37.5" fill="#E35D22" stroke="#C44A10" strokeMiterlimit="10" strokeWidth="2.3" strokeLinecap="round"/>
          
          {/* Ball seams - curved lines */}
          <path className="startPath" d="M400,337.5c-20.71,0-37.5-16.79-37.5-37.5s16.79-37.5,37.5-37.5" fill="none" stroke="#8B2500" strokeLinecap="round" strokeWidth="2.3" strokeDasharray="10 5"/>
          <path className="startPath" d="M400,337.5c-20.71,0-37.5-16.79-37.5-37.5s16.79-37.5,37.5-37.5" fill="none" stroke="#8B2500" strokeLinecap="round" strokeWidth="2.3" strokeDasharray="10 5"/>
          <path className="startPath" d="M400,337.5c-20.71,0-37.5-16.79-37.5-37.5s16.79-37.5,37.5-37.5" fill="none" stroke="#8B2500" strokeLinecap="round" strokeWidth="2.3" strokeDasharray="10 5"/>
          <path className="startPath" d="M400,337.5c-20.71,0-37.5-16.79-37.5-37.5s16.79-37.5,37.5-37.5" fill="none" stroke="#8B2500" strokeLinecap="round" strokeWidth="2.3" strokeDasharray="10 5"/>
          
          {/* Horizontal seam */}
          <line x1="362.5" y1="300" x2="437.5" y2="300" stroke="#8B2500" strokeWidth="2" strokeLinecap="round"/>
          {/* Vertical seam */}
          <line x1="400" y1="262.5" x2="400" y2="337.5" stroke="#8B2500" strokeWidth="2" strokeLinecap="round"/>
        </g>
        
        {/* Shine/Bounce effects */}
        <g id="shineBounce">
          <circle id="ballGradShadow" cx="400" cy="300" r="37.5" fill="url(#ballGrad1)" strokeMiterlimit="10" strokeWidth="4" strokeLinecap="round" opacity="0.3"/>
          <circle id="ballGradShine" cx="400" cy="300" r="37.5" fill="url(#ballShineGrad)" opacity="0.13"/>
        </g>
      </svg>
      
      {text && (
        <p className="text-muted text-sm animate-pulse">{text}</p>
      )}
    </div>
  )
}

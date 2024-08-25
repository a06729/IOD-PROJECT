import React from 'react'

type Props={
    canvasRef:React.MutableRefObject<HTMLCanvasElement|null>;
}

const CanvasComponent = ({canvasRef}:Props) => {
  return (
    <div             
    id="canvas"
    className="h-[100vh] w-full flex justify-center 
    items-center text-center" >
        <canvas ref={canvasRef}/>            
    </div>
  )
}

export default CanvasComponent
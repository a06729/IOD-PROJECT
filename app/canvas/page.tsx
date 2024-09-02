'use client';
import LeftSidebar from "@/components/LeftSidebar";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import { ILineOptions } from "fabric/fabric-impl";
import { handleCanvasMouseDown, handleCanvasMouseUp, handleCanvasObjectModified, handleCanvasObjectMoving, handleCanvasObjectScaling, handleCanvasSelectionCreated, handleCanvaseMouseMove, handlePathCreated, handleResize, initializeFabric, renderCanvas } from "@/lib/canvas";
import { handleDelete, handleKeyDown } from "@/lib/key-events";

import { ActiveElement, Attributes } from "@/types/type";
import CanvasComponent from "@/components/CanvasComponent";
import { defaultNavElement } from "@/constants";
import { handleImageUpload } from "@/lib/shapes";

export default function Page() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const fabricRef=useRef<fabric.Canvas|null>(null);
  const isDrawing=useRef(false);
  const shapeRef=useRef<fabric.Object|null>(null);
  const selectedShapeRef=useRef<String|null>(null);
  const activeObjectRef=useRef<fabric.Object|null>(null);
  const imageInputRef=useRef<HTMLInputElement>(null);
  const isEditingRef=useRef(false);
  
  /**
   * 오브젝트 상태를 저장하는 변수
   */
  const historyStackRef = useRef<any[]>([]);
  /**
   * 오브젝트 상태를 저장한 배열의 인덱스 변호를 저장하는 변수
   */
  const currentStateIndexRef = useRef(-1);

  /**
   * 뒤로가기 앞으로 가기할때 인덱스 값을 +1 시키지 못하게 하기위한 변수
   */
  const isUndoRedoRef = useRef(false); // 추가된 부분


  const [canvasObjects, setCanvasObjects] = useState<any[]>([]);

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: "",
    height: "",
    fontSize: "",
    fontFamily: "",
    fontWeight: "",
    fill: "#aabbcc",
    stroke: "#aabbcc",

  });

    /**
   *
   * Draw smart guides
   */
  const aligningLineOffset = 5
  const aligningLineMargin = 4
  const aligningLineWidth = 1
  const aligningLineColor = 'rgb(255,0,0)'
  const aligningDash = [5, 5]


  const syncShapeInStorage = (object:any) => {
    // object가 null이면 return
    if (!object) return;
    const { objectId } = object;
  
    const shapeData = object.toJSON();
    shapeData.objectId = objectId;
    
    if (!isUndoRedoRef.current) {
      historyCanvas(shapeData); // Save history on mouse up
    }

  
    localStorage.setItem(`canvasObject:${objectId}`, JSON.stringify(shapeData));

    fetchCanvasObjects();
  };

  const [activeElement,setActiveElement]=useState<ActiveElement>({
    name:"",
    value:'',
    icon:''
  });

  //전체 오브젝트 지우는 함수
  const deleteAllShapes=()=>{
    // Get the list of stored canvasObjects
    console.log(`localStorage:${localStorage.length}`);
    for(let i = 0; i < localStorage.length+1; i++) {  
      const key = localStorage.key(i);
      if(key !=null && key.startsWith('canvasObject')){
        localStorage.removeItem(key);
      }
    }
    setCanvasObjects([]);
  }

  const deleteShapeFromStorage=(objectId:string)=>{
    localStorage.removeItem(`canvasObject:${objectId}`);
    console.log("오브젝트 삭제");
    fetchCanvasObjects();
  }

  const handleActiveElement=(elem:ActiveElement)=>{
    setActiveElement(elem);
    switch(elem?.value){
      case 'reset':
        deleteAllShapes();
        fabricRef.current?.clear();
        setActiveElement(defaultNavElement);
        
        break;
      case 'delete':
        handleDelete(fabricRef.current as any,deleteShapeFromStorage);
        setActiveElement(defaultNavElement);
        break;
      case 'image':
        imageInputRef.current?.click();
        isDrawing.current=false;
        if(fabricRef.current){
          fabricRef.current.isDrawingMode=false;
        }
        break;
      default:
        break;
    }
    selectedShapeRef.current=elem?.value as string;
  }



  const undoRedoFetchCanvasObjects = (objects:any) => {
    const objectsList = historyStackRef.current;
    console.log(`objectsList: ${JSON.stringify(objectsList)}`);
    
    // 'canvasObject'로 시작하는 항목을 localStorage에서 삭제
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key != null && key.startsWith('canvasObject')) {
        localStorage.removeItem(key);
      }
    }
  
    // 새로운 객체로 localStorage를 다시 채움
    for (let i = 0; i < objectsList.length; i++) {
      const data = objectsList[i];
      const key = data['objectId'];
      if (key) { // 키가 null이나 undefined가 아님을 확인
        localStorage.setItem(key, JSON.stringify(data));
      }
    }
  }

  /**
   * 오브젝트를 뒤로 돌리는 함수
   */
  const undo = () => {
    if (currentStateIndexRef.current > 0) {
      isUndoRedoRef.current = true; // 추가된 부분
      currentStateIndexRef.current -= 1;
      const history = historyStackRef.current;
      // console.log(`history:${JSON.stringify(historyStackRef.current[currentStateIndexRef.current])}`);
      console.log(`currentStateIndexRef.current:${currentStateIndexRef.current}`);

      undoRedoFetchCanvasObjects(history);
      console.log(`history[currentStateIndexRef.current]:${JSON.stringify(history[currentStateIndexRef.current])}`);
      
      fabricRef.current?.loadFromJSON({"objects":[history[currentStateIndexRef.current]]}, () => {
        fabricRef.current?.renderAll();
        isUndoRedoRef.current = false;
      });
    }
  }
/**
 * 오브젝트를 앞으로 돌리는 함수
 */
  const redo = () => {
    console.log("앞으로 이동");
    if (currentStateIndexRef.current < historyStackRef.current.length - 1) {
      isUndoRedoRef.current = true; // 추가된 부분
      currentStateIndexRef.current += 1;
      const history = historyStackRef.current[currentStateIndexRef.current];
      fabricRef.current?.loadFromJSON({"objects":[history]}, () => {
        fabricRef.current?.renderAll();
        isUndoRedoRef.current = false; // 추가된 부분
      });
    }
  }

  function initAligningGuidelines(canvas: fabric.Canvas) {

    var ctx = canvas.getSelectionContext(),
        aligningLineOffset = 5,
        aligningLineMargin = 4,
        aligningLineWidth = 1,
        aligningLineColor = 'rgb(0,255,0)',
        viewportTransform = canvas.viewportTransform,
        zoom = 1;
  
    function drawVerticalLine(coords:ILineOptions) {
      drawLine(
        coords.x1! + 0.5,
        coords.y1! > coords.y2! ? coords.y2! : coords.y1!,
        coords.x1! + 0.5,
        coords.y2! > coords.y1! ? coords.y2! : coords.y1!);
    }
  
    function drawHorizontalLine(coords:ILineOptions) {
      drawLine(
        coords.x1! > coords.x2! ? coords.x2! : coords.x1!,
        coords.y1! + 0.5,
        coords.x2! > coords.x1! ? coords.x2! : coords.x1!,
        coords.y1 !+ 0.5);
    }
  
    function drawLine(x1:number, y1:number, x2:number, y2:number) {
      ctx.save();
      ctx.lineWidth = aligningLineWidth;
      ctx.strokeStyle = aligningLineColor;
      ctx.beginPath();
      if(viewportTransform){
        ctx.moveTo(((x1+viewportTransform[4])*zoom), ((y1+viewportTransform[5])*zoom));
        ctx.lineTo(((x2+viewportTransform[4])*zoom), ((y2+viewportTransform[5])*zoom));
      }
      ctx.stroke();
      ctx.restore();
    }
  
    function isInRange(value1:number, value2:number) {
      value1 = Math.round(value1);
      value2 = Math.round(value2);
      for (var i = value1 - aligningLineMargin, len = value1 + aligningLineMargin; i <= len; i++) {
        if (i === value2) {
          return true;
        }
      }
      return false;
    }
  
    var verticalLines:ILineOptions[] = [],
        horizontalLines:ILineOptions[] = [];
  
    canvas.on('mouse:down', function () {
      viewportTransform = canvas.viewportTransform;
      zoom = canvas.getZoom();
    });
  
    canvas.on('object:moving', function(e) {
  
      let activeObject = e.target;
      if(!activeObject || !viewportTransform) return;
  
        let canvasObjects = canvas.getObjects();
        let activeObjectCenter = activeObject.getCenterPoint(),
        activeObjectLeft = activeObjectCenter.x,
        activeObjectTop = activeObjectCenter.y,
        activeObjectBoundingRect = activeObject.getBoundingRect(),
        activeObjectHeight = activeObjectBoundingRect.height / viewportTransform[3],
        activeObjectWidth = activeObjectBoundingRect.width / viewportTransform[0],
        horizontalInTheRange = false,
        verticalInTheRange = false,
        transform = canvas.viewportTransform
      
        
      if (!transform) return;
  
      // It should be trivial to DRY this up by encapsulating (repeating) creation of x1, x2, y1, and y2 into functions,
      // but we're not doing it here for perf. reasons -- as this a function that's invoked on every mouse move
  
      for (var i = canvasObjects.length; i--; ) {
  
        if (canvasObjects[i] === activeObject) continue;
  
        var objectCenter = canvasObjects[i].getCenterPoint(),
            objectLeft = objectCenter.x,
            objectTop = objectCenter.y,
            objectBoundingRect = canvasObjects[i].getBoundingRect(),
            objectHeight = objectBoundingRect.height / viewportTransform[3],
            objectWidth = objectBoundingRect.width / viewportTransform[0];
  
        // snap by the horizontal center line
        if (isInRange(objectLeft, activeObjectLeft)) {
          verticalInTheRange = true;
          verticalLines.push({
            x1: objectLeft,
            y1: (objectTop < activeObjectTop)
              ? (objectTop - objectHeight / 2 - aligningLineOffset)
              : (objectTop + objectHeight / 2 + aligningLineOffset),
            y2: (activeObjectTop > objectTop)
              ? (activeObjectTop + activeObjectHeight / 2 + aligningLineOffset)
              : (activeObjectTop - activeObjectHeight / 2 - aligningLineOffset)
          });
          activeObject.setPositionByOrigin(new fabric.Point(objectLeft, activeObjectTop), 'center', 'center');
        }
  
        // snap by the left edge
        if (isInRange(objectLeft - objectWidth / 2, activeObjectLeft - activeObjectWidth / 2)) {
          verticalInTheRange = true;
          verticalLines.push({
            x1: objectLeft - objectWidth / 2,
            y1: (objectTop < activeObjectTop)
              ? (objectTop - objectHeight / 2 - aligningLineOffset)
              : (objectTop + objectHeight / 2 + aligningLineOffset),
            y2: (activeObjectTop > objectTop)
              ? (activeObjectTop + activeObjectHeight / 2 + aligningLineOffset)
              : (activeObjectTop - activeObjectHeight / 2 - aligningLineOffset)
          });
          activeObject.setPositionByOrigin(new fabric.Point(objectLeft - objectWidth / 2 + activeObjectWidth / 2, activeObjectTop), 'center', 'center');
        }
  
        // snap by the right edge
        if (isInRange(objectLeft + objectWidth / 2, activeObjectLeft + activeObjectWidth / 2)) {
          verticalInTheRange = true;
          verticalLines.push({
            x1: objectLeft + objectWidth / 2,
            y1: (objectTop < activeObjectTop)
              ? (objectTop - objectHeight / 2 - aligningLineOffset)
              : (objectTop + objectHeight / 2 + aligningLineOffset),
            y2: (activeObjectTop > objectTop)
              ? (activeObjectTop + activeObjectHeight / 2 + aligningLineOffset)
              : (activeObjectTop - activeObjectHeight / 2 - aligningLineOffset)
          });
          activeObject.setPositionByOrigin(new fabric.Point(objectLeft + objectWidth / 2 - activeObjectWidth / 2, activeObjectTop), 'center', 'center');
        }
  
        // snap by the vertical center line
        if (isInRange(objectTop, activeObjectTop)) {
          horizontalInTheRange = true;
          horizontalLines.push({
            y1: objectTop,
            x1: (objectLeft < activeObjectLeft)
              ? (objectLeft - objectWidth / 2 - aligningLineOffset)
              : (objectLeft + objectWidth / 2 + aligningLineOffset),
            x2: (activeObjectLeft > objectLeft)
              ? (activeObjectLeft + activeObjectWidth / 2 + aligningLineOffset)
              : (activeObjectLeft - activeObjectWidth / 2 - aligningLineOffset)
          });
          activeObject.setPositionByOrigin(new fabric.Point(activeObjectLeft, objectTop), 'center', 'center');
        }
  
        // snap by the top edge
        if (isInRange(objectTop - objectHeight / 2, activeObjectTop - activeObjectHeight / 2)) {
          horizontalInTheRange = true;
          horizontalLines.push({
            y1: objectTop - objectHeight / 2,
            x1: (objectLeft < activeObjectLeft)
              ? (objectLeft - objectWidth / 2 - aligningLineOffset)
              : (objectLeft + objectWidth / 2 + aligningLineOffset),
            x2: (activeObjectLeft > objectLeft)
              ? (activeObjectLeft + activeObjectWidth / 2 + aligningLineOffset)
              : (activeObjectLeft - activeObjectWidth / 2 - aligningLineOffset)
          });
          activeObject.setPositionByOrigin(new fabric.Point(activeObjectLeft, objectTop - objectHeight / 2 + activeObjectHeight / 2), 'center', 'center');
        }
  
        // snap by the bottom edge
        if (isInRange(objectTop + objectHeight / 2, activeObjectTop + activeObjectHeight / 2)) {
          horizontalInTheRange = true;
          horizontalLines.push({
            y1: objectTop + objectHeight / 2,
            x1: (objectLeft < activeObjectLeft)
              ? (objectLeft - objectWidth / 2 - aligningLineOffset)
              : (objectLeft + objectWidth / 2 + aligningLineOffset),
            x2: (activeObjectLeft > objectLeft)
              ? (activeObjectLeft + activeObjectWidth / 2 + aligningLineOffset)
              : (activeObjectLeft - activeObjectWidth / 2 - aligningLineOffset)
          });
          activeObject.setPositionByOrigin(new fabric.Point(activeObjectLeft, objectTop + objectHeight / 2 - activeObjectHeight / 2), 'center', 'center');
        }
      }
  
      if (!horizontalInTheRange) {
        horizontalLines.length = 0;
      }
  
      if (!verticalInTheRange) {
        verticalLines.length = 0;
      }
    });
  
    canvas.on('before:render', function() {
      canvas.clearContext(ctx);
    });
  
    canvas.on('after:render', function() {
      for (var i = verticalLines.length; i--; ) {
        drawVerticalLine(verticalLines[i]);
      }
      for (var i = horizontalLines.length; i--; ) {
        drawHorizontalLine(horizontalLines[i]);
      }
  
      verticalLines.length = horizontalLines.length = 0;
    });
  
    canvas.on('mouse:up', function() {
      verticalLines.length = horizontalLines.length = 0;
      canvas.renderAll();
    });
  }

  useEffect(()=>{
    const canvas=initializeFabric({canvasRef,fabricRef});


    initAligningGuidelines(canvas);
    canvas.on("mouse:down", (options) => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
      });
    });

    canvas.on("mouse:up", (options) => {
        handleCanvasMouseUp({
          canvas,
          isDrawing,
          shapeRef,
          activeObjectRef,
          selectedShapeRef,
          syncShapeInStorage,
          setActiveElement,
        });

      });

    canvas.on("path:created", (options) => {
      handlePathCreated({
        options,
        syncShapeInStorage,
      });

    });

    canvas.on("object:modified", (options) => {
      handleCanvasObjectModified({
        options,
        syncShapeInStorage,
      });
    });

    canvas?.on("object:moving", (options) => {
      const activeObject = options.target;
      // 이동 중인 객체를 가장 위로 가져옴
      activeObject!.bringToFront();
      handleCanvasObjectMoving({
        options,
      });
    });
    
    canvas.on("selection:created", (options) => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      });
    });

    canvas.on("object:scaling",(options)=>{
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });
    });
   
    // initAligningGuidelines();

    return ()=>{
      canvas.dispose();
      window.addEventListener("resize",()=>{
        handleResize({canvas:fabricRef.current});
      });
  
      window.addEventListener("keydown",(e)=>{
        handleKeyDown({
          e,
          canvas:fabricRef.current,
          undo,
          redo,
          syncShapeInStorage,
          deleteShapeFromStorage
        })
      });
  
    }
  },[canvasRef]);



  /**
   * 왼쪽 메뉴에 캔버스에 있는 오브젝트 정보를 띄우기 위한 함수
   */
  const fetchCanvasObjects = () => {
    const canvasObjectsArray = [];
    if(localStorage.length==0){
      setCanvasObjects([]);
    }else{
      for(let i = 0; i < localStorage.length+1; i++) {  
        const key = localStorage.key(i);
        if(key !=null && key?.startsWith("canvasObject")){
          const objectData = localStorage.getItem(key);
          if(objectData !=null){
            const obj = JSON.parse(objectData);
            canvasObjectsArray.push(obj);
          }
        }
      }
      setCanvasObjects(canvasObjectsArray);
    }
  };


  
  /**
   * 캔버스의 진행 정보를 저장하기 위한 함수
   */
  const historyCanvas = (shapeData:any) => {
    if (fabricRef.current) {
      const canvasState = shapeData;
      console.log(`canvasState:${JSON.stringify(canvasState)}`);
      const prevState =  historyStackRef.current.slice(0, currentStateIndexRef.current);
      console.log(`prevState:${JSON.stringify(prevState)}`);
      // historyStackRef.current = historyStackRef.current.slice(0, currentStateIndexRef.current + 1);
      // historyStackRef.current=[...historyStackRef.current,shapeData];
      
      historyStackRef.current.push(...prevState,canvasState );
      currentStateIndexRef.current += 1;
      
      console.log(`historyStack:${JSON.stringify(historyStackRef.current)}`);
      // console.log(`currentStateIndex:${currentStateIndexRef.current}`);
    }
  }
  return (
    <main className="h-screen overflow-hidden">
      <Navbar 
      activeElement={activeElement} 
      imageInputRef={imageInputRef}
      handleImageUpload={(e: any)=>{
        e.stopPropagation();
        handleImageUpload({
          file:e.target.files[0],
          canvas:fabricRef as any,
          shapeRef,
          syncShapeInStorage
        });

      }}
      handleActiveElement={handleActiveElement}/>
      <section className="flex h-full flex-row">
        <LeftSidebar allShapes={canvasObjects}/>
        <CanvasComponent canvasRef={canvasRef}/>
        <RightSidebar         
          elementAttributes={elementAttributes}
          setElementAttributes={setElementAttributes}
          fabricRef={fabricRef}
          isEditingRef={isEditingRef}
          activeObjectRef={activeObjectRef}
          syncShapeInStorage={syncShapeInStorage}
        />
      </section>
    </main>
  );
}
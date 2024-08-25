'use client';
import LeftSidebar from "@/components/LeftSidebar";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
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
    if (currentStateIndexRef.current < historyStackRef.current.length - 1) {
      isUndoRedoRef.current = true; // 추가된 부분
      currentStateIndexRef.current += 1;
      const history = historyStackRef.current[currentStateIndexRef.current];
      fabricRef.current?.loadFromJSON(history, () => {
        fabricRef.current?.renderAll();
        isUndoRedoRef.current = false; // 추가된 부분
      });
    }
  }


  useEffect(()=>{
    const canvas=initializeFabric({canvasRef,fabricRef});
    canvas.on("mouse:down", (options) => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
      });
    });
    canvas.on("mouse:move", (options) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        selectedShapeRef,
        shapeRef,
        syncShapeInStorage,
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

  const undoRedoFetchCanvasObjects=(objects:any)=>{
    const objectsList:any[]=historyStackRef.current;
    console.log(`objectsList:${JSON.stringify(objectsList)}`);
    for(let i = 0; i < localStorage.length+1; i++) {  
      const key = localStorage.key(i);
      if(key !=null && key.startsWith('canvasObject')){
        localStorage.removeItem(key);
      }
    }

    for(let i=0; i< objectsList.length; i++){
      const data=objectsList[i];
      const key=data['objectId'];
      localStorage.setItem(key,JSON.stringify(data));
    }
  }
  
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
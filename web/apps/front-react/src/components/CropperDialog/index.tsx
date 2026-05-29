import { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { Modal, Button, Slider, message, Spin } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import UploadService from '@/services/upload'
import './CropperDialog.css'

interface CropperDialogProps {
  allowTypeList?: string[]
  limitSize?: number
  aspectRatio?: number
  previewWidth?: number
  showWidth?: number
  showHeight?: number
  cropperDisabled?: boolean
  onConfirm?: (result: { url: string; file?: File }) => void
}

export interface CropperDialogRef {
  uploadFile: () => void
  open: (url: string) => void
}

export const CropperDialog = forwardRef<CropperDialogRef, CropperDialogProps>(
  (
    {
      allowTypeList = ['jpg', 'png', 'jpeg'],
      limitSize = 10,
      aspectRatio = 1,
      previewWidth = 160,
      showWidth = 300,
      showHeight = 300,
      cropperDisabled = false,
      onConfirm,
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false)
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [scale, setScale] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [position, setPosition] = useState({ x: 0, y: 0 })

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const reuploadInputRef = useRef<HTMLInputElement>(null)

    const ACCEPT_MAP: Record<string, string> = {
      jpg: 'image/jpg',
      png: 'image/png',
      jpeg: 'image/jpeg',
      ico: 'image/x-icon',
    }

    const acceptTypes = allowTypeList.map((val) => ACCEPT_MAP[val]).join(',')

    useImperativeHandle(ref, () => ({
      uploadFile: () => {
        fileInputRef.current?.click()
      },
      open: (url: string) => {
        setImageSrc(url)
        setVisible(true)
      },
    }))

    const resetState = useCallback(() => {
      setScale(1)
      setRotation(0)
      setPosition({ x: 0, y: 0 })
    }, [])

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Reset input value at the beginning (like console-react)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (reuploadInputRef.current) {
        reuploadInputRef.current.value = ''
      }

      // Check file type
      const type = file.name.substring(file.name.lastIndexOf('.') + 1)
      if (!allowTypeList.includes(type)) {
        message.error(`仅支持 ${allowTypeList.join('、')} 格式的图片`)
        return
      }

      // Check file size
      if (file.size > limitSize * 1024 * 1024) {
        message.error(`图片大小不能超过 ${limitSize}MB`)
        return
      }

      const url = URL.createObjectURL(file)
      setImageSrc(url)

      if (cropperDisabled) {
        // Skip cropping, upload directly
        setUploading(true)
        try {
          const result = await UploadService.uploadImage(file, {
            allowTypes: allowTypeList,
            maxSize: limitSize,
            onError: (error) => {
              message.error(`上传失败：${error.message}`)
            }
          })
          onConfirm?.({ url: result.url, file })
        } catch (error) {
          // Error already handled by UploadService
        } finally {
          setUploading(false)
        }
        return
      }

      resetState()
      setVisible(true)
    }

    const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 3))
    const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5))
    const handleRotate = () => setRotation((prev) => prev + 90)
    const handleReset = () => resetState()

    const getCroppedImage = useCallback(async (): Promise<File | null> => {
      if (!canvasRef.current || !imageSrc) return null

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      const img = new Image()
      img.src = imageSrc

      await new Promise((resolve) => {
        img.onload = resolve
      })

      // Calculate crop dimensions
      const cropSize = Math.min(img.width, img.height)
      const cropX = (img.width - cropSize) / 2
      const cropY = (img.height - cropSize) / 2

      // Set canvas size
      canvas.width = cropSize
      canvas.height = cropSize

      // Apply transformations
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(scale, scale)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)

      // Draw cropped image
      ctx.drawImage(
        img,
        cropX + position.x,
        cropY + position.y,
        cropSize,
        cropSize,
        0,
        0,
        cropSize,
        cropSize
      )
      ctx.restore()

      // Convert to blob
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], 'cropped-image.png', {
                type: 'image/png',
              })
              resolve(file)
            } else {
              resolve(null)
            }
          },
          'image/png',
          1
        )
      })
    }, [imageSrc, scale, rotation, position])

    const handleConfirm = async () => {
      setUploading(true)
      try {
        const croppedFile = await getCroppedImage()
        if (!croppedFile) {
          message.error('裁剪失败')
          return
        }

        // Upload the cropped file
        const result = await UploadService.uploadImage(croppedFile, {
          allowTypes: allowTypeList,
          maxSize: limitSize,
          onError: (error) => {
            message.error(`上传失败：${error.message}`)
          }
        })
        onConfirm?.({ url: result.url, file: croppedFile })
        setVisible(false)
      } catch (error) {
        // Error already handled by UploadService
      } finally {
        setUploading(false)
      }
    }

    const handleClose = () => {
      setVisible(false)
    }

    const handleReupload = () => {
      reuploadInputRef.current?.click()
    }

    return (
      <>
        {/* Hidden input for initial upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Hidden input for reupload */}
        <input
          ref={reuploadInputRef}
          type="file"
          accept={acceptTypes}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <Modal
          open={visible}
          title="图片裁剪"
          width={550}
          closable={!uploading}
          mask={{ closable: false }}
          onCancel={handleClose}
          footer={
            <div className="cropper-footer">
              <Button onClick={handleClose} disabled={uploading}>
                取消
              </Button>
              <Button onClick={handleReset} disabled={uploading}>
                重置
              </Button>
              <Button type="primary" loading={uploading} onClick={handleConfirm}>
                确定
              </Button>
            </div>
          }
        >
          <div className="cropper-content">
            <div className="cropper-left">
              <div
                className="cropper-area"
                style={{ width: showWidth, height: showHeight }}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt="crop"
                    style={{
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                    }}
                  />
                ) : (
                  <Spin />
                )}
              </div>
              <div className="cropper-controls">
                <span
                  className="reupload-text"
                  onClick={handleReupload}
                >
                  重新上传
                </span>
                <div className="controls-buttons">
                  <ZoomInOutlined onClick={handleZoomIn} />
                  <ZoomOutOutlined onClick={handleZoomOut} />
                  <RotateRightOutlined onClick={handleRotate} />
                </div>
              </div>
            </div>

            <div className="cropper-right">
              <div className="preview-text">预览</div>
              <div
                className="preview-area"
                style={{
                  width: previewWidth,
                  height: previewWidth / aspectRatio,
                }}
              >
                {imageSrc && (
                  <img
                    src={imageSrc}
                    alt="preview"
                    style={{
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Modal>
      </>
    )
  }
)

CropperDialog.displayName = 'CropperDialog'

export default CropperDialog

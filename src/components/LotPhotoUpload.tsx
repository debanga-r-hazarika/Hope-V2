import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LotPhotoUploadProps {
  lotId: string;
  existingPhotos: string[];
  onPhotosChange: (photos: string[]) => void;
  disabled?: boolean;
}

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const BUCKET_NAME = 'Raw Material Photos';

export function LotPhotoUpload({ lotId, existingPhotos, onPhotosChange, disabled }: LotPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - existingPhotos.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed per lot`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setError(null);
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          setError(`File "${file.name}" exceeds 2MB limit`);
          continue;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError(`File "${file.name}" is not an image`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${lotId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setError(`Failed to upload "${file.name}": ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(data.path);

        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length > 0) {
        const newPhotos = [...existingPhotos, ...uploadedUrls];
        onPhotosChange(newPhotos);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload photos');
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    try {
      console.log('Delete photo URL:', photoUrl);

      // Extract file path from URL
      // URL format: https://domain.com/storage/v1/object/public/Raw%20Material%20Photos/path/to/file.jpg
      // We need to extract: path/to/file.jpg

      let filePath: string;

      // URL encode the bucket name to match how it appears in the URL
      const encodedBucketName = encodeURIComponent(BUCKET_NAME);
      const bucketPattern = `/object/public/${encodedBucketName}/`;

      console.log('Looking for pattern:', bucketPattern);

      const bucketIndex = photoUrl.indexOf(bucketPattern);

      if (bucketIndex !== -1) {
        // Extract everything after the bucket name
        filePath = photoUrl.substring(bucketIndex + bucketPattern.length);
        console.log('Extracted path (method 1):', filePath);
      } else {
        // Fallback: try with non-encoded bucket name
        const fallbackPattern = `/object/public/${BUCKET_NAME}/`;
        const fallbackIndex = photoUrl.indexOf(fallbackPattern);

        if (fallbackIndex !== -1) {
          filePath = photoUrl.substring(fallbackIndex + fallbackPattern.length);
          console.log('Extracted path (method 2):', filePath);
        } else {
          // Last resort: split by encoded bucket name
          const urlParts = photoUrl.split(`${encodedBucketName}/`);
          if (urlParts.length >= 2) {
            filePath = urlParts[1];
            console.log('Extracted path (method 3):', filePath);
          } else {
            console.error('Invalid photo URL format:', photoUrl);
            console.error('Tried patterns:', bucketPattern, fallbackPattern);
            setError('Invalid photo URL format. Cannot delete.');
            return;
          }
        }
      }

      // Decode URL-encoded characters (like %20 for spaces)
      filePath = decodeURIComponent(filePath);

      console.log('Final file path to delete:', filePath);

      // Delete from Supabase Storage
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        setError(`Failed to delete photo: ${deleteError.message}`);
        return;
      }

      console.log('Photo deleted successfully');

      // Update photos list
      const newPhotos = existingPhotos.filter(url => url !== photoUrl);
      onPhotosChange(newPhotos);
      setError(null);
    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Lot Photos (Optional)
        </label>
        <span className="text-xs text-gray-500">
          {existingPhotos.length}/{MAX_PHOTOS} photos
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Maximum file size: 2 MB per photo. Supported formats: JPG, PNG, GIF, WebP
      </p>

      {/* Photo Grid */}
      {existingPhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {existingPhotos.map((photoUrl, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={photoUrl}
                alt={`Lot photo ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(photoUrl);
                }}
              />
              {!disabled && (
                <button
                  onClick={() => handleDeletePhoto(photoUrl)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Delete photo"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {!disabled && existingPhotos.length < MAX_PHOTOS && (
        <div>
          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Upload Photo{existingPhotos.length < MAX_PHOTOS - 1 ? 's' : ''}
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={uploading || disabled}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

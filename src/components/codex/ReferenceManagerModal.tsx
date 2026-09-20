import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import {
  X,
  Users,
  Check,
  Sparkles,
  User,
  Palette,
  MapPin,
  Shirt,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  CharacterProfile,
  continuityManager,
} from '../../services/codex/ContinuityManager';

interface ReferenceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCharacterChanged: (char: CharacterProfile) => void;
}

export const ReferenceManagerModal: React.FC<ReferenceManagerModalProps> = ({
  isOpen,
  onClose,
  onCharacterChanged,
}) => {
  const [characters, setCharacters] = useState<CharacterProfile[]>(
    continuityManager.getCharacters()
  );
  const [selectedId, setSelectedId] = useState<string>(
    continuityManager.getActiveCharacter().id
  );
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // New character creation state
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newCostume, setNewCostume] = useState<string>('Tactical Cyber Hoodie & Combat Gear');
  const [newLocation, setNewLocation] = useState<string>('Neo-Tokyo High-Altitude Spire');
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [newImageDataUrl, setNewImageDataUrl] = useState<string | null>(null);
  const [isSavingChar, setIsSavingChar] = useState<boolean>(false);
  const newCharImageInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetCharId, setTargetCharId] = useState<string>('sara');

  useEffect(() => {
    if (isOpen) {
      continuityManager.syncWithServer().then((list) => {
        setCharacters(list);
        setSelectedId(continuityManager.getActiveCharacter().id);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (char: CharacterProfile) => {
    setSelectedId(char.id);
    continuityManager.setActiveCharacterProfile(char);
    onCharacterChanged(char);
  };

  const handleTriggerUpload = (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetCharId(charId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImageFile(targetCharId, file);
  };

  const handleDrop = async (charId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadImageFile(charId, file);
  };

  const uploadImageFile = async (charId: string, file: File) => {
    setUploadingFor(charId);
    setUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const res = await fetch('/api/codex/upload-reference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: charId,
            dataUrl,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }

        setCacheBuster(Date.now());
        setUploadSuccess(`Updated ${charId.toUpperCase()} identity illustration!`);
        setTimeout(() => setUploadSuccess(null), 4000);
      } catch (err: any) {
        alert(`Failed to upload reference: ${err.message}`);
      } finally {
        setUploadingFor(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNewCharImageChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setNewImagePreview(dataUrl);
      setNewImageDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNewCharacter = async () => {
    if (!newName.trim()) {
      alert('Please enter a character name');
      return;
    }
    if (!newImageDataUrl) {
      alert('Please select or upload a character identity illustration');
      return;
    }

    setIsSavingChar(true);
    try {
      const safeId = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const profile: CharacterProfile = {
        id: safeId,
        name: newName.trim(),
        identity_reference: `references/characters/${safeId}/identity.png`,
        description: `Custom character created for MV: ${newName.trim()}`,
        defaultLocation: newLocation.trim() || 'Cinematic MV Stage',
        defaultCostume: newCostume.trim() || 'Custom Wardrobe',
        defaultColorPalette: ['#6366f1', '#ec4899', '#06b6d4'],
      };

      const saved = await continuityManager.registerCharacter(profile, newImageDataUrl);
      setCharacters(continuityManager.getCharacters());
      setSelectedId(saved.id);
      onCharacterChanged(saved);
      setIsAddingNew(false);
      setNewName('');
      setNewImagePreview(null);
      setNewImageDataUrl(null);
      setUploadSuccess(`Created and activated character: ${saved.name}`);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: any) {
      alert(`Failed to save character: ${err.message}`);
    } finally {
      setIsSavingChar(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-850 border border-surface-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden font-mono text-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={handleFileChosen}
        />
        <input
          ref={newCharImageInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={handleNewCharImageChosen}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60 bg-surface-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Character & Scene Reference Manager
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Dynamic Character Roster: Add custom characters or upload illustrations for Codex Keyframe Bridge
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 rounded-lg hover:bg-surface-750 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Banner */}
        {uploadSuccess && (
          <div className="px-6 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Characters Grid & Creator */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Select Active Character for Direction:</span>
            <button
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNew ? 'Close Creator' : 'Create New Character'}</span>
            </button>
          </div>

          {/* New Character Inline Creator */}
          {isAddingNew && (
            <div className="p-4 bg-surface-900 border border-indigo-500/40 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-white font-bold">
                <span>Create New Character Profile:</span>
                <button
                  onClick={() => setIsAddingNew(false)}
                  aria-label="新規キャラクター作成を閉じる"
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Left: Image upload box */}
                <div
                  onClick={() => newCharImageInputRef.current?.click()}
                  className="border-2 border-dashed border-surface-700 hover:border-indigo-400 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-surface-950 aspect-video relative overflow-hidden"
                >
                  {newImagePreview ? (
                    <>
                      <img
                        src={newImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white">
                        Change Image
                      </span>
                    </>
                  ) : (
                    <div className="flex flex-col items-center space-y-1 text-center text-slate-400">
                      <Upload className="w-5 h-5 text-indigo-400" />
                      <span className="text-[11px] font-semibold text-slate-200">
                        Upload Identity Art (Required)
                      </span>
                      <span className="text-[10px] text-slate-500">PNG, JPG or WEBP</span>
                    </div>
                  )}
                </div>

                {/* Right: Name, Costume, Location inputs */}
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Character Name *
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Amber, Cloel, Zax, Custom Hero..."
                      className="w-full px-2.5 py-1.5 rounded bg-surface-950 border border-surface-750 text-white focus:border-indigo-500 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Signature Costume / Outfit
                    </label>
                    <input
                      type="text"
                      value={newCostume}
                      onChange={(e) => setNewCostume(e.target.value)}
                      placeholder="e.g. Tactical Cyber Hoodie & Combat Gear"
                      className="w-full px-2.5 py-1.5 rounded bg-surface-950 border border-surface-750 text-white focus:border-indigo-500 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      World Location / Setting
                    </label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="e.g. High-Altitude Cyber Spire"
                      className="w-full px-2.5 py-1.5 rounded bg-surface-950 border border-surface-750 text-white focus:border-indigo-500 outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1 border-t border-surface-800">
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1 rounded bg-surface-800 text-slate-400 hover:text-white text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewCharacter}
                  disabled={isSavingChar || !newName.trim() || !newImageDataUrl}
                  className="flex items-center space-x-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-40"
                >
                  <span>{isSavingChar ? 'Saving...' : 'Save & Select Character'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {characters.map((char) => {
              const isSelected = char.id === selectedId;
              const isUploading = uploadingFor === char.id;
              const imgSrc = `/api/codex/image?path=${encodeURIComponent(char.identity_reference)}&v=${cacheBuster}`;

              return (
                <div
                  key={char.id}
                  onClick={() => handleSelect(char)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(char.id, e)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col space-y-3 relative group ${
                    isSelected
                      ? 'bg-indigo-950/30 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg'
                      : 'bg-surface-900/80 border-surface-750 hover:border-surface-600'
                  }`}
                >
                  {/* Active Badge */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center space-x-1 z-10">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  )}

                  {/* Image Preview & Upload Overlay */}
                  <div className="aspect-video bg-surface-950 rounded-lg overflow-hidden border border-surface-800 flex items-center justify-center relative">
                    <img
                      src={imgSrc}
                      alt={char.name}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Path Label */}
                    <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-slate-300 backdrop-blur-sm z-10">
                      {char.identity_reference}
                    </div>

                    {/* Quick Upload Button */}
                    <button
                      onClick={(e) => handleTriggerUpload(char.id, e)}
                      disabled={isUploading}
                      className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 hover:bg-indigo-600 text-[10px] text-white border border-white/20 transition flex items-center space-x-1.5 z-10 shadow-md backdrop-blur-sm"
                      title="Upload custom character image file"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                    </button>
                  </div>

                  {/* Profile info */}
                  <div>
                    <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                      <User className="w-4 h-4 text-indigo-400" />
                      <span>{char.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {char.description}
                    </p>
                  </div>

                  {/* Attributes */}
                  <div className="space-y-1 text-[10.5px] text-slate-400 border-t border-surface-800 pt-2 font-mono">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{char.defaultLocation}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Shirt className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{char.defaultCostume}</span>
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <Palette className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <div className="flex items-center space-x-1">
                        {char.defaultColorPalette.map((color, idx) => (
                          <div
                            key={idx}
                            className="w-3 h-3 rounded-full border border-surface-700"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-surface-700/60 bg-surface-900/80 flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-500">
            Open Character Architecture: Unlimited custom profiles with identity lock
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

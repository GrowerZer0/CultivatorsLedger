'use client';

import React, { useState, useTransition } from 'react';
import { recordDailyCheckInLog, DailyCheckInFormData } from '@/app/actions';

// Define types for training events directly from the interface in app/actions.ts
type TrainingEvent = DailyCheckInFormData['trainingEvent'];

// Placeholder for a toast library - for now, we'll just log or show a simple message
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  console.log(`Toast (${type}): ${message}`);
  // In a real app, you'd integrate a library like react-hot-toast or similar.
};

export function DailyCheckIn() {
  const [selectedPlantId, setSelectedPlantId] = useState<string>(''); // Placeholder, ideally from props or fetched
  const [weight, setWeight] = useState<number | ''>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [watered, setWatered] = useState<boolean>(false);
  const [fed, setFed] = useState<boolean>(false);
  const [trainingEvent, setTrainingEvent] = useState<TrainingEvent>('None');
  const [notes, setNotes] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Placeholder plant data for the selector
  const mockPlants = [
    { id: 'plant-1', name: 'Strawberry Cough #1' },
    { id: 'plant-2', name: 'Blue Dream Batch A' },
    { id: 'plant-3', name: 'Green Goblin #2' },
  ];

  const trainingEventsArray: TrainingEvent[] = ['None', 'Top', 'Defoliate', 'LST', 'Flip', 'Harvest'];


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setPhotoFile(event.target.files[0]);
    } else {
      setPhotoFile(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!selectedPlantId || weight === '') {
      setMessage('Please select a plant and enter a weight.');
      showToast('Please select a plant and enter a weight.', 'error');
      return;
    }

    startTransition(async () => {
      let photoUrl: string | undefined;
      // In a real app, you'd upload photoFile to storage (e.g., Supabase Storage)
      // and get a URL back. For this example, we'll just mock it.
      if (photoFile) {
        photoUrl = `mock-photo-url/${photoFile.name}`; // Simplified mock URL
      }

      const payload: DailyCheckInFormData = {
        plantId: selectedPlantId,
        weight: Number(weight),
        photoUrl,
        watered,
        fed,
        trainingEvent,
        notes: notes || undefined,
      };

      try {
        const result = await recordDailyCheckInLog(payload);

        if (result && result.error) {
          throw new Error(result.error);
        }

        showToast('Check-in recorded successfully!', 'success');
        setMessage('Check-in recorded successfully!');
        // Reset essential fields
        setWeight('');
        setPhotoFile(null);
        setWatered(false);
        setFed(false);
        setTrainingEvent('None');
        setNotes('');
        // setSelectedPlantId(''); // Optionally reset plant selection
      } catch (error: any) {
        console.error('Check-in failed:', error);
        showToast(`Check-in failed: ${error.message || 'Unknown error'}`, 'error');
        setMessage(`Check-in failed: ${error.message || 'Unknown error'}`);
      }
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 shadow-xl max-w-md mx-auto">
      <h2 className="text-xl font-bold text-cyan-400 mb-6 text-center">Daily Plant Check-In</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Plant/Batch Selector */}
        <div>
          <label htmlFor="plant-selector" className="block text-sm font-medium text-zinc-300 mb-1">
            Plant/Batch
          </label>
          <select
            id="plant-selector"
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="w-full p-2 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
            required
          >
            <option value="" disabled>Select a plant</option>
            {mockPlants.map((plant) => (
              <option key={plant.id} value={plant.id}>{plant.name}</option>
            ))}
          </select>
        </div>

        {/* Weight Input */}
        <div>
          <label htmlFor="weight" className="block text-sm font-medium text-zinc-300 mb-1">
            Current Weight (g)
          </label>
          <input
            type="number"
            id="weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-2 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
            placeholder="e.g., 1500"
            autoFocus
            required
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label htmlFor="photo" className="block text-sm font-medium text-zinc-300 mb-1">
            Photo (Optional)
          </label>
          <input
            type="file"
            id="photo"
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-400
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-cyan-600 file:text-white
                       hover:file:bg-cyan-700
                       cursor-pointer"
            accept="image/*"
          />
          {photoFile && <p className="mt-1 text-xs text-zinc-400">Selected: {photoFile.name}</p>}
        </div>

        {/* Watered / Fed Toggles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-zinc-300 mb-1">Watered?</span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setWatered(true)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  watered ? 'bg-cyan-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWatered(false)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !watered ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                No
              </button>
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-zinc-300 mb-1">Fed?</span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setFed(true)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  fed ? 'bg-cyan-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setFed(false)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !fed ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>

        {/* Training Event Selector */}
        <div>
          <span className="block text-sm font-medium text-zinc-300 mb-1">Training Event</span>
          <div className="flex flex-wrap gap-2">
            {trainingEventsArray.map((event) => (
              <button
                key={event}
                type="button"
                onClick={() => setTrainingEvent(event)}
                className={`py-1.5 px-3 rounded-full text-xs font-medium transition-colors ${
                  trainingEvent === event
                    ? 'bg-cyan-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {event}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-300 mb-1">
            Notes (Optional, one-line)
          </label>
          <input
            type="text"
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 bg-zinc-800 text-zinc-100 border border-zinc-700 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
            placeholder="Add a quick note..."
            maxLength={100} // Keep notes concise
          />
        </div>

        {/* Message Display */}
        {message && (
          <p className={`text-center text-sm ${message.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
            {message}
          </p>
        )}

        {/* Primary Action Button */}
        <button
          type="submit"
          className="w-full py-3 px-4 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isPending}
        >
          {isPending ? 'Submitting...' : 'Finish Check-In'}
        </button>
      </form>
    </div>
  );
}

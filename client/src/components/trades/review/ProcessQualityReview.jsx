import React from 'react';

const ToggleGroup = ({ label, name, register, watchValue }) => {
  const isYes = watchValue === 'true';
  const isNo = watchValue === 'false';
  return (
    <div>
      <label className="block text-sm text-muted mb-2">{label}</label>
      <div className="flex bg-surface p-1 rounded-lg border border-border">
        <label className={`flex-1 text-center py-2 text-sm font-medium rounded-md cursor-pointer transition ${isYes ? 'bg-green-500 text-gray-900' : 'text-muted hover:text-gray-200'}`}>
          <input type="radio" value="true" {...register(name)} className="hidden" />
          Yes
        </label>
        <label className={`flex-1 text-center py-2 text-sm font-medium rounded-md cursor-pointer transition ${isNo ? 'bg-red-500 text-white' : 'text-muted hover:text-gray-200'}`}>
          <input type="radio" value="false" {...register(name)} className="hidden" />
          No
        </label>
      </div>
    </div>
  );
};

const ProcessQualityReview = ({ register, watch }) => {
  return (
    <section className="bg-surface-muted p-6 rounded-xl border border-border space-y-4">
      <h3 className="text-lg font-medium text-green-400">Process Quality</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ToggleGroup label="Followed trading plan?" name="followedPlan" register={register} watch={watch} watchValue={watch('followedPlan')} />
        <ToggleGroup label="A+ setup?" name="isAPlusSetup" register={register} watch={watch} watchValue={watch('isAPlusSetup')} />
        <ToggleGroup label="News related?" name="newsRelated" register={register} watch={watch} watchValue={watch('newsRelated')} />
        
        <div>
          <label className="block text-sm text-muted mb-2">Trade Grade</label>
          <select {...register('grade')} className="block w-full bg-surface border border-border rounded-lg py-2.5 px-3 focus:outline-none focus:border-green-500">
            <option value="">Ungraded</option>
            <option value="A_PLUS">A+ (Perfect)</option>
            <option value="A">A (Excellent)</option>
            <option value="B">B (Good)</option>
            <option value="C">C (Okay but flawed)</option>
            <option value="D">D (Strayed from plan)</option>
            <option value="MISTAKE">Mistake (Fatal flaw)</option>
          </select>
        </div>
      </div>
    </section>
  );
};

export default ProcessQualityReview;

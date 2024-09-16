import React, { useEffect, useState } from 'react';
import BigOptionSelector from '@/common/components/BigOptionSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isAddress } from 'viem';
import DeployHatsDelegatorContract from '../DeployHatsDelegatorContract';
import { WarpcastImage } from '../PostEmbeddedContent/WarpcastImage';

export enum OwnershipSetupSteps {
  unknown = 'UNKNOWN',
  new_tree = 'NEW_TREE',
  existing_tree = 'EXISTING_TREE',
}

type SharedAccountOwnershipSetupProps = {
  onSuccess: () => void;
  delegatorContractAddress: `0x${string}`;
  setDelegatorContractAddress: (address: string) => void;
  defaultStep?: OwnershipSetupSteps;
  adminHatId?: bigint;
  casterHatId?: bigint;
};

export const SharedAccountOwnershipSetup = ({
  onSuccess,
  delegatorContractAddress,
  setDelegatorContractAddress,
  defaultStep,
  adminHatId,
  casterHatId,
}: SharedAccountOwnershipSetupProps) => {
  const [state, setState] = useState<OwnershipSetupSteps>(defaultStep || OwnershipSetupSteps.unknown);

  useEffect(() => {
    if (defaultStep && defaultStep !== state) {
      setState(defaultStep);
    }
  }, [defaultStep]);

  const renderStep = () => {
    switch (state) {
      case OwnershipSetupSteps.unknown:
        return renderUnknownStep();
      case OwnershipSetupSteps.new_tree:
        return renderUnpreparedStep();
      case OwnershipSetupSteps.existing_tree:
        return renderExistingTreeStep();
      default:
        return null;
    }
  };

  const renderUnpreparedStep = () => (
    <div>
      Go to Hats Protocol to create a Hats tree and then come back here to continue <br />
      Visit{' '}
      <a href=" https://app.hatsprotocol.xyz/trees/new" target="_blank" className="underline" rel="noreferrer">
        https://app.hatsprotocol.xyz
      </a>{' '}
      to create a tree.
    </div>
  );

  const renderExistingTreeStep = () => (
    <div className="flex flex-col space-x-2 lg:flex-row lg:space-x-8">
      <div className="lg:w-1/2">
        <DeployHatsDelegatorContract
          adminHatId={adminHatId}
          casterHatId={casterHatId}
          onSuccess={onSuccess}
          delegatorContractAddress={delegatorContractAddress}
          setDelegatorContractAddress={setDelegatorContractAddress}
        />
      </div>
    </div>
  );

  const renderGoBack = () =>
    state !== OwnershipSetupSteps.unknown && (
      <Button className="mt-8" variant="outline" onClick={() => setState(OwnershipSetupSteps.unknown)}>
        Go back
      </Button>
    );

  const renderUnknownStep = () => (
    <BigOptionSelector
      options={[
        {
          title: 'I have no delegator contract',
          description: "Let's deploy your own Farcaster delegator contract",
          buttonText: 'Create a delegator contract',
          onClick: () => setState(OwnershipSetupSteps.existing_tree),
        },
        {
          title: 'I have deployed a delegator contract',
          description: 'Submit the Optimism contract address and continue',
          content: (
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="0x1234..."
                onChange={(e) => setDelegatorContractAddress(e.target.value)}
              />
              <Button
                variant="default"
                disabled={!delegatorContractAddress || !isAddress(delegatorContractAddress)}
                onClick={() => onSuccess()}
              >
                Submit
              </Button>
            </div>
          ),
        },
      ]}
    />
  );

  return (
    <div>
      {renderStep()}
      {renderGoBack()}
    </div>
  );
};

export default SharedAccountOwnershipSetup;

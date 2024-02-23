import React, { useState } from "react";
import BigOptionSelector from "@/common/components/BigOptionSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAddress } from "viem";
import DeployHatsDelegatorContract from "./DeployHatsDelegatorContract";

enum OwnershipSetupSteps {
  unknown = "UNKNOWN",
  unprepared = "UNPREPARED",
  existing_tree = "EXISTING_TREE",
  delegator_contract = "DELEGATOR_CONTRACT",
}

const SharedAccountOwnershipSetup = ({
  onSuccess,
  delegatorContractAddress,
  setDelegatorContractAddress,
}) => {
  const [state, setState] = useState<OwnershipSetupSteps>(
    OwnershipSetupSteps.unknown
  );
  const [hatsTreeAddress, setHatsTreeAddress] = useState<string>("");

  const renderStep = () => {
    switch (state) {
      case OwnershipSetupSteps.unknown:
        return renderUnknownStep();
      case OwnershipSetupSteps.unprepared:
        return renderUnpreparedStep();
      case OwnershipSetupSteps.existing_tree:
        return renderExistingTreeStep();
      case OwnershipSetupSteps.delegator_contract:
        return renderDelegatorContractStep();
      default:
        return null;
    }
  };

  const renderUnpreparedStep = () => (
    <div>
      Current not supported, you can go to Hats Protocol at{" "}
      <a href="https://app.hatsprotocol.xyz" target="_blank" className="underline" rel="noreferrer">
        https://app.hatsprotocol.xyz
      </a>{" "}
      to create a tree.
    </div>
  );
  const renderExistingTreeStep = () => (
    <DeployHatsDelegatorContract onSuccess={onSuccess} />
  );
  const renderDelegatorContractStep = () => <div></div>;

  const renderGoBack = () =>
    state !== OwnershipSetupSteps.unknown && (
      <Button
        className="mt-8"
        variant="default"
        onClick={() => setState(OwnershipSetupSteps.unknown)}
      >
        Go back
      </Button>
    );

  const renderUnknownStep = () => (
    <BigOptionSelector
      options={[
        {
          title: "I don't have a Hats tree yet",
          description:
            "Let's setup a Hats tree and deploy a delegator contract",
          buttonText: "Start setup",
          onClick: () => setState(OwnershipSetupSteps.unprepared),
        },
        {
          title: "I have an existing Hats tree",
          description: "Let's deploy your own Farcaster delegator contract",
          buttonText: "Start deplyoment",
          onClick: () => setState(OwnershipSetupSteps.existing_tree),
        },
        {
          title: "I have deployed a delegator contract",
          description: "Submit the Optimism contract address and continue",
          content: (
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="0x1234..."
                onChange={(e) => setDelegatorContractAddress(e.target.value)}
              />
              <Button
                variant="default"
                disabled={
                  !delegatorContractAddress ||
                  !isAddress(delegatorContractAddress)
                }
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
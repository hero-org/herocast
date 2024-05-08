import React, { useState } from "react";
import BigOptionSelector from "@/common/components/BigOptionSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAddress } from "viem";
import DeployHatsDelegatorContract from "./DeployHatsDelegatorContract";
import { WarpcastImage } from "./PostEmbeddedContent/WarpcastImage";

enum OwnershipSetupSteps {
  unknown = "UNKNOWN",
  unprepared = "UNPREPARED",
  existing_tree = "EXISTING_TREE",
}

const SharedAccountOwnershipSetup = ({
  onSuccess,
  delegatorContractAddress,
  setDelegatorContractAddress,
}) => {
  const [state, setState] = useState<OwnershipSetupSteps>(
    OwnershipSetupSteps.unknown
  );

  const renderStep = () => {
    switch (state) {
      case OwnershipSetupSteps.unknown:
        return renderUnknownStep();
      case OwnershipSetupSteps.unprepared:
        return renderUnpreparedStep();
      case OwnershipSetupSteps.existing_tree:
        return renderExistingTreeStep();
      // case OwnershipSetupSteps.delegator_contract:
      // return renderDelegatorContractStep();
      default:
        return null;
    }
  };

  const renderUnpreparedStep = () => (
    <div>
      Go to Hats Protocol to create a Hats tree and then come back here to
      continue <br />
      Visit{" "}
      <a
        href=" https://app.hatsprotocol.xyz/trees/new"
        target="_blank"
        className="underline"
        rel="noreferrer"
      >
        https://app.hatsprotocol.xyz
      </a>{" "}
      to create a tree.
    </div>
  );

  const renderExistingTreeStep = () => (
    <div className="flex flex-col space-x-2 lg:flex-row lg:space-x-8">
      <div className="lg:w-1/2">
      <DeployHatsDelegatorContract
        onSuccess={onSuccess}
        delegatorContractAddress={delegatorContractAddress}
        setDelegatorContractAddress={setDelegatorContractAddress}
        />
      </div>
      <div className="mt-4 lg:w-1/2 lg:mt-0">
        <div className="mx-0 max-w-2xl">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            How to get your Hats IDs
          </h3>
          <p className="mt-2 text-md leading-8 text-foreground/70">
            Go to the{" "}
            <a
              href="https://app.hatsprotocol.xyz"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Hats app
            </a>{" "}
            and click on the tree you want to use. In the top right corner, you
            will see the tree ID and the Hats ID. You will need to use the Hats
            ID for the admin role and for the caster role.
          </p>
        </div>
        <WarpcastImage url="https://i.imgur.com/pgl0n75.gif" />
      </div>
    </div>
  );

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
          title: "I have no delegator contract",
          description: "Let's deploy your own Farcaster delegator contract",
          buttonText: "Create a delegator contract",
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

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OptionSelectorType = {
  title: string;
  description: string;
  buttonText: string;
  content?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type BigOptionSelectorProps = {
  options: OptionSelectorType[];
};

const BigOptionSelector = ({ options }: BigOptionSelectorProps) => {
  const renderOption = (option: OptionSelectorType) => {
    if (!option) return null;

    return (
      <Card key={option.title} className="max-w-sm col-span-1">
        <CardHeader>
          <CardTitle>{option.title}</CardTitle>
          <CardDescription>{option.description}</CardDescription>
        </CardHeader>
        {option.content ? <CardContent>{option.content}</CardContent> : null}
        {option.buttonText ? (
          <CardFooter>
            <Button
              className="w-full"
              disabled={option.disabled}
              onClick={() => option.onClick()}
            >
              {option.buttonText}
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    );
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {options.map((option) => renderOption(option))}
    </div>
  );
};

export default BigOptionSelector;

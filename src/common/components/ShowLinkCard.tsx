import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { openWindow } from '../helpers/navigation';

type ShowLinkCardProps = {
  title: string;
  description: string;
  link: string;
  buttonLabel: string;
};

const ShowLinkCard = ({ title, description, link, buttonLabel }: ShowLinkCardProps) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex">
        <Label htmlFor="link" className="sr-only">
          Link
        </Label>
        <Input id="link" value={link} readOnly className="mr-2" />
        <Button variant="secondary" className="shrink-0" onClick={() => openWindow(link)}>
          {buttonLabel}
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default ShowLinkCard;
